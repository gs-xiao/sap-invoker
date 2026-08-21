import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { FormProvider } from '@formily/react'
import { FormLayout } from '@formily/antd-v5'
import {
  ConfigProvider, message, Alert, Button, Space, Badge, Segmented, Dropdown,
  Input as AntInput, Modal,
} from 'antd'
import {
  DatabaseOutlined, SearchOutlined, CloudDownloadOutlined, ThunderboltOutlined,
  ApiOutlined, AppstoreOutlined, CodeOutlined, FileTextOutlined,
  SendOutlined, EyeOutlined, ColumnHeightOutlined, ThunderboltFilled,
} from '@ant-design/icons'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'

import { ENVIRONMENTS, SAP, IS_DEV } from './config'
import { theme, SURFACE, HAIRLINE, BRAND, MUTED, CONTENT_MAX } from './theme'
import { SchemaField } from './form/schemaField'
import { BlockCollapseContext } from './form/layout'
import { metadataToSchema } from './metadataToSchema'
import { stripInternalKeys, checkedKeysToConfig, hideEmptyValues } from './visibility'
import { fetchMetadata as apiFetchMetadata, submitCall, store as sapStore } from './api/sapClient'
import { useDynamicForm } from './hooks/useDynamicForm'
import { useCallHistory } from './hooks/useCallHistory'
import { useVariants } from './hooks/useVariants'
import { downloadJson, timestampName } from './utils/file'
import AssetHubModal from './components/AssetHubModal'
import ConnectionPopover from './components/ConnectionPopover'
import SchemaPane from './components/SchemaPane'
import PayloadPane from './components/PayloadPane'
import ResultModal from './components/ResultModal'
import VisibilityModal from './components/VisibilityModal'

// 顶栏右侧「全部折叠 / 字段显隐」这类次级动作装在一个浅灰槽里，跟主色的提交按钮拉开层次
const BTN_GROUP_STYLE = {
  display: 'inline-flex',
  gap: 2,
  padding: 2,
  background: '#eef2f7',
  borderRadius: 10,
}

// 资产中心按钮上的小圆计数
const pill = (bg, color) => ({
  display: 'inline-block',
  minWidth: 18,
  padding: '0 6px',
  marginLeft: 4,
  background: bg,
  color,
  fontSize: 11,
  fontWeight: 700,
  lineHeight: '17px',
  borderRadius: 9,
  textAlign: 'center',
})

// 主区三个面板：始终挂载，靠 display 切换。
//
// 绝不能改成条件渲染 —— 表单面板一旦从 DOM 摘掉，Formily 字段模型会走 onUnmount 从
// form graph 里移除，切回来时已填的值、ArrayTable 的行、校验态全部重来。
const Pane = ({ show, children }) => (
  <div style={{ display: show ? 'flex' : 'none', flexDirection: 'column', height: '100%', minHeight: 0 }}>
    {children}
  </div>
)

export default function App() {
  // 表单生命周期（schema / 显隐 / form 重建 / 派生数据）集中在此 hook
  const {
    applied, config, setConfig,
    form, renderSchema, treeData, allLeafKeys, checkedKeys,
    applySchema, applySchemaKeepState, restore,
  } = useDynamicForm()

  // 接口认证参数（元数据、提交调用、记录/变式/分享 存储 API 都复用）
  // 本地开发默认连开发环境；部署到 BSP 后环境选择器会隐藏，应明确标记为生产环境，
  // 避免调用记录虽然走生产服务，却被保存成 env=dev / “开发”。
  const [env, setEnv] = useState(IS_DEV ? 'dev' : 'prod')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const getAuth = useCallback(() => ({ env, username, password }), [env, username, password])

  // 调用记录 & 变式（SAP 后端存储，异步）
  const {
    history, loading: historyLoading, refresh: refreshHistory,
    recordCall, renameCall, deleteHistory, clearHistory, getFull: getHistoryFull,
    exportAll: exportHistoryAll, exportOne: exportHistoryOne, importBundle: importHistory,
  } = useCallHistory(getAuth)
  const {
    variants, loading: variantLoading, refresh: refreshVariants,
    saveVariant, deleteVariant, clearVariants, getFull: getVariantFull,
    exportAll: exportVariantAll, exportOne: exportVariantOne, importBundle: importVariants,
  } = useVariants(getAuth)

  // 「分享给我的」收件箱
  const [inbox, setInbox] = useState([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const refreshInbox = useCallback(async () => {
    setInboxLoading(true)
    try {
      const list = await sapStore.shareInbox(getAuth())
      setInbox(Array.isArray(list) ? list : [])
    } catch { /* 未登录/无权限时静默，打开弹窗会再提示 */ } finally {
      setInboxLoading(false)
    }
  }, [getAuth])

  // 分享弹窗（手动填接收人 SAP 用户名 + 附言）
  const [shareTarget, setShareTarget] = useState(null) // 正在分享的记录
  const [shareUname, setShareUname] = useState('')
  const [shareNote, setShareNote] = useState('')
  const [shareBusy, setShareBusy] = useState(false)

  // 主区 Tab：动态表单 / JSON Schema / 请求 Body
  const [mainTab, setMainTab] = useState('form')

  // 元数据 → Schema 相关
  const [schemaMode, setSchemaMode] = useState('meta')   // Schema 页的输入格式：'meta' | 'schema'
  const [metaText, setMetaText] = useState('')           // Formily Schema 编辑框内容
  const [metaInputText, setMetaInputText] = useState('') // 手填的中性元数据 JSON
  const [metaError, setMetaError] = useState('')
  const [metaFuncName, setMetaFuncName] = useState(SAP.defaultFuncName) // 目标 FM 函数名
  const [metaLoading, setMetaLoading] = useState(false)
  const [fetchMode, setFetchMode] = useState('normal')   // 函数栏拉取方式：'normal' | 'ai'

  // 接口调用结果相关
  const [result, setResult] = useState(null)     // { ok, status, body }
  const [resultOpen, setResultOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 数据资产中心弹窗（调用记录 / 变式 / 分享给我的，三个 Tab 合一）
  const [hubOpen, setHubOpen] = useState(false)

  // 字段显隐配置
  const [visOpen, setVisOpen] = useState(false)
  const [visView, setVisView] = useState('tree')    // 'tree' | 'json'
  const [visJsonText, setVisJsonText] = useState('') // JSON 视图文本
  const [visJsonError, setVisJsonError] = useState('')

  // 是否已有可用表单（applied 里有字段/栅格）
  const hasForm = !!(applied?.properties && Object.keys(applied.properties).length > 0)

  // 未读分享数：顶栏资产中心按钮上的小红点
  const unreadShares = inbox.filter((i) => i.read_flag !== 'X').length

  // 全部展开/折叠：collapseCmd 每点一次换一个新对象广播给所有 Block；allCollapsed 控制按钮文案
  const [collapseCmd, setCollapseCmd] = useState(null)
  const [allCollapsed, setAllCollapsed] = useState(false)
  const toggleCollapseAll = () => {
    const next = !allCollapsed
    setAllCollapsed(next)
    setCollapseCmd({ open: !next }) // next=折叠 → open:false
  }
  // 换了 schema（重新生成/恢复记录）→ 复位为「全部展开」文案（新块默认展开）
  useEffect(() => { setAllCollapsed(false) }, [applied])

  // Schema 页的编辑框始终反映「当前生效的 Schema」。恢复记录/变式也会走这里，
  // 否则切到 Schema 页看到的还是上一个表单的结构。
  useEffect(() => {
    setMetaText(applied?.properties && Object.keys(applied.properties).length
      ? JSON.stringify(applied, null, 2)
      : '')
  }, [applied])

  // Tab 右侧的结构概览：顶层 FormGrid 里装的是叶子字段，其余顶层键是 STRUCTURE/TABLE 容器
  const { leafCount, blockCount } = useMemo(() => {
    let leaf = 0, block = 0
    for (const v of Object.values(applied?.properties ?? {})) {
      if (v?.['x-component'] === 'FormGrid') leaf += Object.keys(v.properties ?? {}).length
      else block += 1
    }
    return { leafCount: leaf, blockCount: block }
  }, [applied])

  // ---- 元数据 → 表单 ----

  // Schema 页的「Formily Schema」格式：编辑框内容就是当前表单的 Schema，点应用即生成/更新表单。
  // 用 applySchemaKeepState：保留当前已填值与显隐配置，只更新结构/布局，避免微调 JSON 就丢数据。
  const applyJsonToForm = () => {
    try {
      const schema = JSON.parse(metaText)
      applySchemaKeepState(schema)
      setMetaError('')
      setMainTab('form')
      message.success('已按 JSON 更新表单')
    } catch (e) {
      setMetaError('JSON 解析失败：' + e.message)
    }
  }

  // Schema 页的「中性元数据」格式：不走接口，直接把手填的元数据 JSON 转 Schema → 生成表单
  const convertMetaAndGenerate = () => {
    let meta
    try {
      meta = JSON.parse(metaInputText)
    } catch (e) {
      setMetaError('元数据 JSON 解析失败：' + e.message)
      return
    }
    let schema
    try {
      schema = metadataToSchema(meta)
    } catch (e) {
      setMetaError('元数据转换 Schema 失败：' + e.message)
      return
    }
    applySchema(schema)                            // 直接生成表单
    setMetaText(JSON.stringify(schema, null, 2))   // 同步进 Schema 编辑框，便于后续查看/微调
    setMetaError('')
    setMainTab('form')
    message.success('已按手填元数据生成表单')
  }

  // 函数栏一键：调 SAP 拉元数据 → 转 Schema → 直接生成表单（复用当前环境 + 账号密码）。
  // action 缺省走普通元数据服务；传 SAP.metadataAiAction 即走 AI 方式（入参/出参一致）。
  const fetchAndGenerate = async ({ action = SAP.metadataAction, ai = false } = {}) => {
    if (!metaFuncName.trim()) { message.error('请填写目标函数名'); return }
    setMetaLoading(true)
    try {
      const meta = await apiFetchMetadata({ env, username, password, funcName: metaFuncName.trim(), action })
      let schema
      try {
        schema = metadataToSchema(meta)
      } catch (e) {
        setMetaError('元数据转换 Schema 失败：' + e.message)
        setMainTab('schema')
        return
      }
      applySchema(schema)                            // 直接生成表单
      setMetaText(JSON.stringify(schema, null, 2))   // 同步进 Schema 编辑框，便于后续查看/微调
      setMetaError('')
      setMainTab('form')
      message.success(ai ? '已用 AI 获取元数据并生成表单' : '已获取元数据并生成表单')
    } catch (e) {
      // 拉取失败把错误显示在 Schema 页（那里有 Alert 位），同时切过去让用户看得见
      setMetaError(e.message)
      setMainTab('schema')
      message.error('获取元数据失败：' + e.message)
    } finally {
      setMetaLoading(false)
    }
  }

  // 函数栏拉取按钮：主键执行当前选中的方式，下拉里可切换
  const FETCH_MODES = {
    normal: { label: '从 SAP 后端拉取', run: () => fetchAndGenerate() },
    ai: { label: 'AI 智能解析', run: () => fetchAndGenerate({ action: SAP.metadataAiAction, ai: true }) },
  }

  // ---- 数据填充 ----

  // 把一份 values 填充进当前已存在的表单：先清旧值（含数组行），再合并填充
  const fillValues = async (values) => {
    await form.reset('*', { forceClear: true, validate: false })
    form.setValues(values)
  }

  // ---- 调用记录 / 变式：打开即拉列表 ----

  // 首次挂载 best-effort 拉一次（BSP 会话有效时即出数；本地未填账号时静默失败，打开弹窗会再拉）
  useEffect(() => {
    refreshHistory().catch(() => {})
    refreshVariants().catch(() => {})
    refreshInbox().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 连接设置（环境 / 账号）的提交 ----
  //
  // 环境和账号是「填好点按钮才生效」的，不随输入实时变。点下去做两件事：
  // 先用刚填的这套凭据真发一次请求探连通性与鉴权，通了才提交到全局 state 并重拉列表。
  // 探测这一次必须把 next 显式传给 API —— 同一个事件里 setState 还没提交，
  // getAuth() 拿到的仍是旧值；至于要读 state 的 refreshHistory/refreshVariants，
  // 交给下面 connTick 的 effect 在 state 提交之后再跑。
  const [connBusy, setConnBusy] = useState(false)
  const [connTick, setConnTick] = useState(0)

  const applyConnection = async (next) => {
    setConnBusy(true)
    try {
      // 拿收件箱当探针：只读、轻量，结果本身也用得上；账号错会是 HTTP 401，环境没配会直接抛
      const list = await sapStore.shareInbox(next)
      setInbox(Array.isArray(list) ? list : [])
      setEnv(next.env)
      setUsername(next.username)
      setPassword(next.password)
      setConnTick((t) => t + 1)
      message.success(`已连接【${ENVIRONMENTS[next.env]?.label || next.env}】`)
      return true
    } catch (e) {
      message.error('连接失败：' + e.message)
      return false // 返回 false 让弹层留在原地，方便直接改
    } finally {
      setConnBusy(false)
    }
  }

  useEffect(() => {
    if (!connTick) return
    refreshHistory().catch((e) => message.error('加载记录失败：' + e.message))
    refreshVariants().catch((e) => message.error('加载变式失败：' + e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connTick])

  // 打开资产中心：三份列表并发刷新，任一失败只提示不阻塞其余
  const openAssetHub = () => {
    setHubOpen(true)
    refreshHistory().catch((e) => message.error('加载记录失败：' + e.message))
    refreshVariants().catch((e) => message.error('加载变式失败：' + e.message))
    refreshInbox()
  }

  // ---- 调用记录 ----

  // 危险操作统一走这个二次确认。原先「清空记录/清空变式」点了就执行，
  // 反倒是可撤销得多的「变式重名覆盖」有确认框，轻重是反的。
  const confirmDanger = (title, content, okText) =>
    new Promise((resolve) => {
      Modal.confirm({
        title, content, okText, cancelText: '取消',
        okButtonProps: { danger: true },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      })
    })

  const restoreFromHistory = async (rec) => {
    try {
      const full = await getHistoryFull(rec.id)
      restore(full?.schema || applied, full?.values || {}, full?.config || {})
      if (rec.action) setMetaFuncName(rec.action)
      if (rec.env && ENVIRONMENTS[rec.env]) setEnv(rec.env)
      setHubOpen(false)
      message.success('已从记录填充')
    } catch (e) { message.error('填充失败：' + e.message) }
  }

  const onDeleteHistory = async (rec) => {
    const label = rec.name || rec.action || '这条记录'
    if (!await confirmDanger('删除调用记录', `将删除「${label}」，无法恢复。`, '删除')) return
    try { await deleteHistory(rec.id); await refreshHistory(); message.success('已删除该记录') }
    catch (e) { message.error('删除失败：' + e.message) }
  }
  const onClearHistory = async () => {
    if (!await confirmDanger('清空调用记录', `将删除全部 ${history.length} 条调用记录，无法恢复。`, '清空')) return
    try { await clearHistory(); await refreshHistory(); message.success('已清空调用记录') }
    catch (e) { message.error('清空失败：' + e.message) }
  }
  const onRenameHistory = async (id, name) => {
    try { await renameCall(id, name.trim()); await refreshHistory(); message.success('已重命名') }
    catch (e) { message.error('重命名失败：' + e.message) }
  }

  // 查看某条记录当时的接口返回消息（按需拉完整数据，复用结果弹窗）
  const onViewHistoryBody = async (rec) => {
    try {
      const full = await getHistoryFull(rec.id)
      setResult({ ok: rec.ok, status: rec.status, body: full?.body ?? '（该记录未存返回消息）' })
      setResultOpen(true)
    } catch (e) { message.error('读取失败：' + e.message) }
  }

  const onExportHistory = async () => {
    if (!history.length) { message.warning('暂无调用记录可下载'); return }
    try {
      downloadJson(timestampName('call-history'), await exportHistoryAll())
      message.success('已下载全部调用记录')
    } catch (e) { message.error('下载失败：' + e.message) }
  }
  const onExportOne = async (rec) => {
    try {
      const safe = (rec.name || rec.action || 'record').replace(/[^\w.-]+/g, '_').slice(0, 40)
      downloadJson(timestampName(`call-record-${safe}`), await exportHistoryOne(rec))
      message.success('已下载该条记录')
    } catch (e) { message.error('下载失败：' + e.message) }
  }
  const onImportHistoryFile = async (file) => {
    try {
      const added = await importHistory(JSON.parse(await file.text()))
      message.success(`已导入 ${added} 条记录`)
    } catch (e) { message.error('导入失败：' + e.message) }
  }

  // ---- 变式（命名的表单状态：值 + Schema + 显隐配置）----

  // 重名时问一次要不要覆盖。后端没有「按名 upsert」的 op，只能删旧+插新；
  // 顺序是先插后删——中途失败最多留下两条同名（用户可自行删掉），不会把旧变式弄丢。
  const onSaveVariant = async (name) => {
    const dup = variants.find((v) => (v.name || '').trim() === name)
    if (dup) {
      const confirmed = await new Promise((resolve) => {
        Modal.confirm({
          title: '变式重名',
          content: `已存在同名变式「${name}」，覆盖后旧的那条会被删除。`,
          okText: '覆盖',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      })
      if (!confirmed) return false
    }
    try {
      await saveVariant({ name, applied, values: stripInternalKeys(form.values ?? {}), config, action: metaFuncName.trim() })
      if (dup) {
        await deleteVariant(dup.id)
        await refreshVariants() // deleteVariant 不自带刷新（不像 saveVariant）
      }
      message.success(dup ? `已覆盖变式「${name}」` : `已保存变式「${name}」`)
      return true // 告诉弹窗可以清空输入框了
    } catch (e) { message.error('保存失败：' + e.message); return false }
  }

  const restoreVariant = async (rec) => {
    try {
      const full = await getVariantFull(rec.id)
      restore(full?.schema || applied, full?.values || {}, full?.config || {})
      if (rec.action) setMetaFuncName(rec.action)
      setHubOpen(false)
      message.success(`已应用变式「${rec.name || '未命名'}」`)
    } catch (e) { message.error('应用失败：' + e.message) }
  }

  const onDeleteVariant = async (rec) => {
    if (!await confirmDanger('删除变式', `将删除变式「${rec.name || '未命名'}」，无法恢复。`, '删除')) return
    try { await deleteVariant(rec.id); await refreshVariants(); message.success('已删除该变式') }
    catch (e) { message.error('删除失败：' + e.message) }
  }
  const onClearVariants = async () => {
    if (!await confirmDanger('清空变式', `将删除全部 ${variants.length} 个变式，无法恢复。`, '清空')) return
    try { await clearVariants(); await refreshVariants(); message.success('已清空变式') }
    catch (e) { message.error('清空失败：' + e.message) }
  }
  const onExportVariants = async () => {
    if (!variants.length) { message.warning('暂无变式可下载'); return }
    try {
      downloadJson(timestampName('variants'), await exportVariantAll())
      message.success('已下载全部变式')
    } catch (e) { message.error('下载失败：' + e.message) }
  }
  const onExportOneVariant = async (rec) => {
    try {
      const safe = (rec.name || 'variant').replace(/[^\w.-]+/g, '_').slice(0, 40)
      downloadJson(timestampName(`variant-${safe}`), await exportVariantOne(rec))
      message.success('已下载该变式')
    } catch (e) { message.error('下载失败：' + e.message) }
  }
  const onImportVariantFile = async (file) => {
    try {
      const added = await importVariants(JSON.parse(await file.text()))
      message.success(`已导入 ${added} 个变式`)
    } catch (e) { message.error('导入失败：' + e.message) }
  }

  // ---- 分享 & 收件箱 ----

  const openShare = (rec) => { setShareTarget(rec); setShareUname(''); setShareNote('') }
  const doShare = async () => {
    if (!shareUname.trim()) { message.error('请填写接收人 SAP 用户名'); return }
    setShareBusy(true)
    try {
      await sapStore.shareAdd(shareTarget.id, shareUname.trim(), shareNote.trim(), getAuth())
      message.success('已分享给 ' + shareUname.trim().toUpperCase())
      setShareTarget(null)
    } catch (e) { message.error('分享失败：' + e.message) } finally { setShareBusy(false) }
  }

  // 收件箱：填充（读取分享的完整数据还原到表单）
  const onInboxFill = async (it) => {
    try {
      const full = await sapStore.shareGet(it.share_id, getAuth())
      restore(full?.schema || applied, full?.values || {}, full?.config || {})
      if (it.action) setMetaFuncName(it.action)
      setHubOpen(false)
      refreshInbox() // 已读态更新
      message.success('已从分享填充')
    } catch (e) { message.error('填充失败：' + e.message) }
  }
  // 收件箱：另存为我的（复制成自己的记录，占自己额度）。
  // 环境/状态得从收件箱条目带过来——之前这里一律传空串，另存出来的调用记录在列表里
  // 显示成红色「失败」+ 空环境 Tag，看着像是这次调用真的失败过。
  // 注：payload 里只有 {schema,values,config,body}，环境与状态是独立的表列，取不到就留空，
  // 列表侧会显示成「状态未知」而不是「失败」。
  const onInboxSaveAs = async (it) => {
    try {
      const full = await sapStore.shareGet(it.share_id, getAuth())
      await sapStore.recSave({
        kind: it.kind, rec_name: it.name || '', action: it.action || '',
        environ: it.environ || '',
        env_label: it.env_label || '',
        ok_flag: it.ok === 'X' || it.ok === true ? 'X' : '',
        status: it.status == null ? '' : String(it.status),
        payload: JSON.stringify(full || {}),
      }, getAuth())
      if (it.kind === 'VAR') refreshVariants(); else refreshHistory()
      refreshInbox()
      message.success('已另存为我的' + (it.kind === 'VAR' ? '变式' : '调用记录'))
    } catch (e) { message.error('另存为失败：' + e.message) }
  }
  const onInboxRemove = async (it) => {
    try { await sapStore.shareRemove(it.share_id, getAuth()); await refreshInbox(); message.success('已移除') }
    catch (e) { message.error('移除失败：' + e.message) }
  }

  // ---- 提交调用 SAP ----

  // 校验通过后，values 就是最终要回传给 FM 的入参 JSON
  const handleSubmit = async (values) => {
    if (!ENVIRONMENTS[env]?.url) {
      message.error(`【${ENVIRONMENTS[env]?.label || env}】环境地址未配置`)
      return
    }
    if (!metaFuncName.trim()) {
      message.error('请先在顶部函数栏填写 SAP 函数名称')
      return
    }
    const action = metaFuncName.trim()
    const payload = stripInternalKeys(values) // 剥掉 Formily 内部 key，再作为 FM 入参
    try {
      const res = await submitCall({ env, username, password, action, payload })
      setResult(res)
      setResultOpen(true)
      try { await recordCall({ applied, values: payload, ok: res.ok, status: res.status, env, envLabel: ENVIRONMENTS[env].label, action, config, body: res.body }) } catch { /* 记录落库失败不影响调用结果 */ }
      if (res.ok) message.success('调用成功')
      else message.error(`接口返回 HTTP ${res.status}`)
    } catch (e) {
      // 网络错误 / CORS 拦截通常走这里
      setResult({ ok: false, status: '请求失败', body: String(e) })
      setResultOpen(true)
      try { await recordCall({ applied, values: payload, ok: false, status: '请求失败', env, envLabel: ENVIRONMENTS[env].label, action, config, body: String(e) }) } catch { /* 同上 */ }
      message.error('请求失败：' + e.message)
    }
  }

  // 顶栏「提交」：先跑校验，通过才调 handleSubmit；不通过各字段就地标红
  const doSubmit = async () => {
    setSubmitting(true)
    try {
      await form.submit(handleSubmit)
    } catch {
      message.error('表单校验未通过，请检查标红字段')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- 字段显隐配置 ----

  const openVisConfig = () => {
    setVisJsonText(JSON.stringify(config, null, 2))
    setVisJsonError('')
    setVisView('tree')
    setVisOpen(true)
  }

  // 统一更新 config，并把 JSON 文本同步刷新（树 → JSON 方向）
  const updateConfig = (next) => {
    setConfig(next)
    setVisJsonText(JSON.stringify(next, null, 2))
    setVisJsonError('')
  }

  // Tree 勾选变化：checkedKeys 为「可见」的 key，反推 config（只记录被隐藏叶子）
  const onTreeCheck = (keys) => {
    const leafChecked = (Array.isArray(keys) ? keys : keys.checked).filter((k) => allLeafKeys.includes(k))
    updateConfig(checkedKeysToConfig(leafChecked, allLeafKeys))
  }

  const applyHideEmpty = () => {
    updateConfig(hideEmptyValues(form.values, applied))
    message.success('已按当前数据隐藏空值字段')
  }

  // 应用右侧 JSON 文本（显式解析，失败提示不崩）
  const applyVisJson = () => {
    try {
      const parsed = JSON.parse(visJsonText)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setVisJsonError('配置必须是一个 JSON 对象')
        return
      }
      setConfig(parsed)
      setVisJsonError('')
      message.success('已应用 JSON 配置')
    } catch (e) {
      setVisJsonError('JSON 解析失败：' + e.message)
    }
  }

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      {/* 纵向 Flex：顶栏 + 函数栏固定不滚，主区 Tab 自己撑满剩余高度 */}
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', background: SURFACE }}>

        {/* ===== ① 顶栏：身份 + 环境 + 全局动作 ===== */}
        <div
          style={{
            flex: '0 0 auto',
            background: '#fff',
            borderBottom: `1px solid ${HAIRLINE}`,
            padding: '10px 16px',
            zIndex: 10,
          }}
        >
          <div style={{ maxWidth: CONTENT_MAX, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* 左：品牌标识 + 标题/副标题两行 + 环境 chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 34, height: 34, borderRadius: 10, background: BRAND, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, boxShadow: '0 4px 10px rgba(37,99,235,.25)',
                }}
              >
                <ApiOutlined />
              </div>
              <div style={{ lineHeight: 1.35 }}>
                <Space size={8}>
                  <strong style={{ fontSize: 15 }}>SAP 动态表单工作台</strong>
                  <ConnectionPopover
                    env={env}
                    username={username}
                    password={password}
                    onApply={applyConnection}
                    applying={connBusy}
                  />
                </Space>
                <div style={{ color: MUTED, fontSize: 11 }}>Formily 驱动 · 元数据即表单</div>
              </div>
            </div>

            {/* 右：资产中心 + 次级动作组 + 主操作 */}
            <Space wrap size={10}>
              <Badge dot count={unreadShares} offset={[-6, 4]}>
                <Button icon={<DatabaseOutlined />} onClick={openAssetHub} loading={historyLoading || variantLoading}>
                  数据资产中心
                  <span style={pill('#dbeafe', '#1d4ed8')} title="调用记录数">{history.length}</span>
                  <span style={pill('#fef3c7', '#b45309')} title="变式数">{variants.length}</span>
                </Button>
              </Badge>

              <div style={BTN_GROUP_STYLE}>
                <Button type="text" icon={<ColumnHeightOutlined />} onClick={toggleCollapseAll} disabled={!hasForm}>
                  {allCollapsed ? '全部展开' : '全部折叠'}
                </Button>
                <Button type="text" icon={<EyeOutlined />} onClick={openVisConfig} disabled={!hasForm}>
                  字段显隐
                </Button>
              </div>

              <Button type="primary" danger icon={<SendOutlined />} loading={submitting} disabled={!hasForm} onClick={doSubmit}>
                提交并调用 SAP
              </Button>
            </Space>
          </div>
        </div>

        {/* ===== ② 函数栏：常驻，随时能看到/改「当前要调哪个 FM」 ===== */}
        <div
          style={{
            flex: '0 0 auto',
            background: '#fff',
            borderBottom: `1px solid ${HAIRLINE}`,
            padding: '10px 16px',
          }}
        >
          <Space wrap size={8} style={{ maxWidth: CONTENT_MAX, margin: '0 auto', display: 'flex' }}>
            <span style={{ color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <ThunderboltFilled style={{ color: BRAND }} />
              SAP 函数名称
            </span>
            <AntInput
              value={metaFuncName}
              onChange={(e) => setMetaFuncName(e.target.value)}
              onPressEnter={FETCH_MODES[fetchMode].run}
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="如 ZTEST_STR"
              style={{ width: 280 }}
            />
            {/* 拆分按钮：主键执行当前方式，下拉切换普通 / AI 解析（两者并列，不做自动降级） */}
            <Dropdown.Button
              type="primary"
              loading={metaLoading}
              icon={<span style={{ fontSize: 10 }}>▾</span>}
              onClick={FETCH_MODES[fetchMode].run}
              menu={{
                selectable: true,
                selectedKeys: [fetchMode],
                items: [
                  { key: 'normal', icon: <CloudDownloadOutlined />, label: FETCH_MODES.normal.label },
                  { key: 'ai', icon: <ThunderboltOutlined />, label: FETCH_MODES.ai.label },
                ],
                // 下拉只切换方式，不顺手执行。AI 解析那条是要花钱花时间的，
                // 展开菜单看一眼有哪些选项就触发一次请求太吓人；选完由用户自己点主键。
                onClick: ({ key }) => setFetchMode(key),
              }}
            >
              {FETCH_MODES[fetchMode].label}
            </Dropdown.Button>
          </Space>
        </div>

        {/* ===== ③ 主区三个面板 =====
            页签用 Segmented（胶囊样式）而不是 antd Tabs：Tabs 的 type="card" 选中背景写死在
            样式里、token 改不了，做不出「选中=主色底白字」；换成 Segmented 后面板归我们自己管，
            高度也能规规矩矩用 flex 撑满，不必再拿 calc(100vh - 178px) 去猜顶部占了多高。

            代价是「切换时不能卸载面板」这条约束从依赖 antd 的默认行为变成我们自己保证 ——
            见上面 Pane 组件，用 display 切换，绝不条件渲染。 */}
        <div
          style={{
            flex: '1 1 auto', minHeight: 0, padding: '12px 16px',
            maxWidth: CONTENT_MAX, width: '100%', margin: '0 auto', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
          }}
        >
          <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <Segmented
              value={mainTab}
              onChange={setMainTab}
              options={[
                { value: 'form', label: '动态表单视图', icon: <AppstoreOutlined /> },
                { value: 'schema', label: 'JSON Schema 结构', icon: <CodeOutlined /> },
                { value: 'payload', label: '请求 Body 预览 & 填充', icon: <FileTextOutlined /> },
              ]}
            />
            {hasForm && (
              <span style={{ color: MUTED, fontSize: 12 }}>
                表头字段 {leafCount} 个 · 表结构 {blockCount} 个
              </span>
            )}
          </div>

          <div style={{ flex: '1 1 auto', minHeight: 0 }}>
            <Pane show={mainTab === 'form'}>
              <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
                {!hasForm && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="尚未生成表单"
                    description="在上方函数栏填 FM 名称后点「从 SAP 后端拉取」；也可以切到「JSON Schema 结构」页手动粘贴元数据或 Schema。"
                  />
                )}
                <BlockCollapseContext.Provider value={collapseCmd}>
                  <FormProvider form={form}>
                    <FormLayout layout="vertical">
                      <SchemaField schema={renderSchema} />
                    </FormLayout>
                  </FormProvider>
                </BlockCollapseContext.Provider>
              </div>
            </Pane>

            <Pane show={mainTab === 'schema'}>
              <SchemaPane
                mode={schemaMode}
                setMode={setSchemaMode}
                metaText={metaInputText}
                setMetaText={setMetaInputText}
                onConvertMeta={convertMetaAndGenerate}
                schemaText={metaText}
                setSchemaText={setMetaText}
                onApplySchema={applyJsonToForm}
                error={metaError}
              />
            </Pane>

            <Pane show={mainTab === 'payload'}>
              <PayloadPane
                form={form}
                active={mainTab === 'payload'}
                onFill={fillValues}
                disabled={!hasForm}
              />
            </Pane>
          </div>
        </div>

        {/* ===== 弹窗 ===== */}
        <AssetHubModal
          open={hubOpen}
          onClose={() => setHubOpen(false)}
          history={{
            list: history,
            loading: historyLoading,
            onFill: restoreFromHistory,
            onRename: onRenameHistory,
            onViewBody: onViewHistoryBody,
            onShare: openShare,
            onDelete: onDeleteHistory,
            onClear: onClearHistory,
            onExportAll: onExportHistory,
            onExportOne,
            onImportFile: onImportHistoryFile,
          }}
          variants={{
            list: variants,
            loading: variantLoading,
            canSave: hasForm,
            onSave: onSaveVariant,
            onFill: restoreVariant,
            onShare: openShare,
            onDelete: onDeleteVariant,
            onClear: onClearVariants,
            onExportAll: onExportVariants,
            onExportOne: onExportOneVariant,
            onImportFile: onImportVariantFile,
          }}
          inbox={{
            list: inbox,
            loading: inboxLoading,
            onFill: onInboxFill,
            onSaveAs: onInboxSaveAs,
            onRemove: onInboxRemove,
          }}
        />

        {/* 分享小窗：手动填接收人 SAP 用户名 + 附言（全用 antd 现成组件） */}
        <Modal
          title={shareTarget ? `分享「${shareTarget.name || shareTarget.action || '记录'}」给指定人` : '分享'}
          open={!!shareTarget}
          onCancel={() => setShareTarget(null)}
          onOk={doShare}
          confirmLoading={shareBusy}
          okText="分享"
          cancelText="取消"
        >
          <div style={{ marginBottom: 6 }}>接收人 SAP 用户名：</div>
          <AntInput
            value={shareUname}
            onChange={(e) => setShareUname(e.target.value)}
            onPressEnter={doShare}
            placeholder="如 ZHANGSAN（对方登录 SAP 的账号）"
            autoFocus
          />
          <div style={{ margin: '12px 0 6px' }}>附言（可选）：</div>
          <AntInput.TextArea
            value={shareNote}
            onChange={(e) => setShareNote(e.target.value)}
            rows={2}
            maxLength={100}
            placeholder="给对方留句话"
          />
        </Modal>

        <ResultModal open={resultOpen} onClose={() => setResultOpen(false)} result={result} />

        <VisibilityModal
          open={visOpen}
          onClose={() => setVisOpen(false)}
          treeData={treeData}
          checkedKeys={checkedKeys}
          onTreeCheck={onTreeCheck}
          visView={visView}
          setVisView={setVisView}
          config={config}
          visJsonText={visJsonText}
          setVisJsonText={setVisJsonText}
          visJsonError={visJsonError}
          onApplyJson={applyVisJson}
          onApplyHideEmpty={applyHideEmpty}
          onShowAll={() => updateConfig({})}
          onHideAll={() => updateConfig(checkedKeysToConfig([], allLeafKeys))}
        />
      </div>
    </ConfigProvider>
  )
}
