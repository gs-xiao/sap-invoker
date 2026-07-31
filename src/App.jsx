import React, { useState, useEffect, useCallback } from 'react'
import { FormProvider } from '@formily/react'
import { FormLayout } from '@formily/antd-v5'
import {
  ConfigProvider, message, Alert, Button, Space,
  Select as AntSelect, Input as AntInput, Modal,
} from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'

import { ENVIRONMENTS, SAP, STORAGE, IS_DEV } from './config'
import { SchemaField } from './form/schemaField'
import { BlockCollapseContext } from './form/layout'
import { metadataToSchema } from './metadataToSchema'
import { stripInternalKeys, checkedKeysToConfig, hideEmptyValues } from './visibility'
import { fetchMetadata as apiFetchMetadata, submitCall, store as sapStore } from './api/sapClient'
import { useDynamicForm } from './hooks/useDynamicForm'
import { useCallHistory } from './hooks/useCallHistory'
import { useVariants } from './hooks/useVariants'
import { useVisibilityProfiles } from './hooks/useVisibilityProfiles'
import { downloadJson, timestampName } from './utils/file'
import MetaModal from './components/MetaModal'
import DataFillModal from './components/DataFillModal'
import HistoryModal from './components/HistoryModal'
import VariantModal from './components/VariantModal'
import ShareInboxModal from './components/ShareInboxModal'
import ResultModal from './components/ResultModal'
import VisibilityModal from './components/VisibilityModal'
import ProfileModal from './components/ProfileModal'

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

  // 调用记录 & 变式（SAP 后端存储，异步）& 显隐方案（仍本地）
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
  const { profiles, saveProfile, deleteProfile, clearProfiles } = useVisibilityProfiles()

  // 「分享给我的」收件箱
  const [inboxOpen, setInboxOpen] = useState(false)
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

  // 数据回填相关
  const [dataOpen, setDataOpen] = useState(false)
  const [dataText, setDataText] = useState('')
  const [dataError, setDataError] = useState('')

  // 元数据 → Schema 相关
  const [metaOpen, setMetaOpen] = useState(false)
  const [metaText, setMetaText] = useState('') // JSON 编辑框内容 = 当前表单的 Formily Schema
  const [metaError, setMetaError] = useState('')
  const [metaShowJson, setMetaShowJson] = useState(false) // 是否展开 JSON Schema 编辑区
  const [metaShowInput, setMetaShowInput] = useState(false) // 是否展开「手动填写元数据」区
  const [metaInputText, setMetaInputText] = useState('') // 手填的中性元数据 JSON
  const [metaFuncName, setMetaFuncName] = useState(SAP.defaultFuncName) // 目标 FM 函数名
  const [metaLoading, setMetaLoading] = useState(false)
  const [metaAiLoading, setMetaAiLoading] = useState(false) // AI 获取元数据按钮的 loading

  // 接口调用结果相关
  const [result, setResult] = useState(null)     // { ok, status, body }
  const [resultOpen, setResultOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 调用记录弹窗
  const [historyOpen, setHistoryOpen] = useState(false)
  // 变式弹窗
  const [variantOpen, setVariantOpen] = useState(false)

  // 字段显隐配置
  const [visOpen, setVisOpen] = useState(false)
  const [visView, setVisView] = useState('tree')    // 'tree' | 'json'
  const [visJsonText, setVisJsonText] = useState('') // JSON 视图文本
  const [visJsonError, setVisJsonError] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)

  // 是否已有可用表单（applied 里有字段/栅格）
  const hasForm = !!(applied?.properties && Object.keys(applied.properties).length > 0)

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

  // ---- 元数据 → 表单 ----

  // 打开数据回填弹窗，预填当前表单已有的值
  const openDataFill = () => {
    setDataText(JSON.stringify(stripInternalKeys(form.values ?? {}), null, 2))
    setDataError('')
    setDataOpen(true)
  }

  // 打开「元数据 → 表单」：默认收起 JSON；预填 JSON 编辑框 = 当前已生成的 Schema
  const openMeta = () => {
    setMetaText(hasForm ? JSON.stringify(applied, null, 2) : '')
    setMetaShowJson(false)
    setMetaShowInput(false)
    setMetaError('')
    setMetaOpen(true)
  }

  // 展开的 JSON 编辑框内容就是 Formily Schema，点「应用到表单」直接生成/更新表单。
  // 用 applySchemaKeepState：保留当前已填值与显隐配置，只更新结构/布局，避免微调 JSON 就丢数据。
  const applyJsonToForm = () => {
    try {
      const schema = JSON.parse(metaText)
      applySchemaKeepState(schema)
      setMetaError('')
      message.success('已按 JSON 更新表单')
    } catch (e) {
      setMetaError('JSON 解析失败：' + e.message)
    }
  }

  // 不走接口：把手填的「中性元数据 JSON」走 metadataToSchema 转 Schema → 生成表单
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
    setMetaText(JSON.stringify(schema, null, 2))   // 同步进 JSON Schema 编辑框，便于后续查看/微调
    setMetaError('')
    setMetaOpen(false)
    message.success('已按手填元数据生成表单')
  }

  // 一键：调 SAP 拉元数据 → 转 Schema → 直接生成表单并关闭弹窗（复用当前环境 + 账号密码）。
  // action 缺省走普通元数据服务；传 SAP.metadataAiAction 即走 AI 方式（入参/出参一致）。
  const fetchAndGenerate = async ({ action = SAP.metadataAction, ai = false } = {}) => {
    if (!metaFuncName.trim()) { message.error('请填写目标函数名'); return }
    const setLoading = ai ? setMetaAiLoading : setMetaLoading
    setLoading(true)
    try {
      const meta = await apiFetchMetadata({ env, username, password, funcName: metaFuncName.trim(), action })
      let schema
      try {
        schema = metadataToSchema(meta)
      } catch (e) {
        setMetaError('元数据转换 Schema 失败：' + e.message)
        return
      }
      applySchema(schema)                            // 直接生成表单
      setMetaText(JSON.stringify(schema, null, 2))   // 同步进 JSON 编辑框，便于后续查看/微调
      setMetaError('')
      setMetaOpen(false)
      message.success(ai ? '已用 AI 获取元数据并生成表单' : '已获取元数据并生成表单')
    } catch (e) {
      setMetaError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ---- 数据填充 ----

  // 把一份 values 填充进当前已存在的表单：先清旧值（含数组行），再合并填充
  const fillValues = async (values) => {
    await form.reset('*', { forceClear: true, validate: false })
    form.setValues(values)
  }

  const handleFill = async () => {
    let parsed
    try {
      parsed = JSON.parse(dataText)
    } catch (e) {
      setDataError('JSON 解析失败：' + e.message)
      return
    }
    try {
      await fillValues(parsed)
      setDataError('')
      setDataOpen(false)
      message.success('已按 JSON 填充表单')
    } catch (e) {
      setDataError('填充失败：' + e.message)
    }
  }

  // ---- 调用记录 / 变式：打开即拉列表 ----

  // 首次挂载 best-effort 拉一次（BSP 会话有效时即出数；本地未填账号时静默失败，打开弹窗会再拉）
  useEffect(() => {
    refreshHistory().catch(() => {})
    refreshVariants().catch(() => {})
    refreshInbox().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openHistory = () => { setHistoryOpen(true); refreshHistory().catch((e) => message.error('加载记录失败：' + e.message)) }
  const openVariants = () => { setVariantOpen(true); refreshVariants().catch((e) => message.error('加载变式失败：' + e.message)) }
  const openInbox = () => { setInboxOpen(true); refreshInbox() }

  // ---- 调用记录 ----

  const restoreFromHistory = async (rec) => {
    try {
      const full = await getHistoryFull(rec.id)
      restore(full?.schema || applied, full?.values || {}, full?.config || {})
      if (rec.action) setMetaFuncName(rec.action)
      if (rec.env && ENVIRONMENTS[rec.env]) setEnv(rec.env)
      setHistoryOpen(false)
      message.success('已从记录填充')
    } catch (e) { message.error('填充失败：' + e.message) }
  }

  const onDeleteHistory = async (id) => {
    try { await deleteHistory(id); await refreshHistory(); message.success('已删除该记录') }
    catch (e) { message.error('删除失败：' + e.message) }
  }
  const onClearHistory = async () => {
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

  const onSaveVariant = async (name) => {
    try {
      await saveVariant({ name, applied, values: stripInternalKeys(form.values ?? {}), config, action: metaFuncName.trim() })
      await refreshVariants()
      message.success(`已保存变式「${name}」`)
    } catch (e) { message.error('保存失败：' + e.message) }
  }

  const restoreVariant = async (rec) => {
    try {
      const full = await getVariantFull(rec.id)
      restore(full?.schema || applied, full?.values || {}, full?.config || {})
      if (rec.action) setMetaFuncName(rec.action)
      setVariantOpen(false)
      message.success(`已应用变式「${rec.name || '未命名'}」`)
    } catch (e) { message.error('应用失败：' + e.message) }
  }

  const onDeleteVariant = async (id) => {
    try { await deleteVariant(id); await refreshVariants(); message.success('已删除该变式') }
    catch (e) { message.error('删除失败：' + e.message) }
  }
  const onClearVariants = async () => {
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
      setInboxOpen(false)
      refreshInbox() // 已读态更新
      message.success('已从分享填充')
    } catch (e) { message.error('填充失败：' + e.message) }
  }
  // 收件箱：另存为我的（复制成自己的记录，占自己额度）
  const onInboxSaveAs = async (it) => {
    try {
      const full = await sapStore.shareGet(it.share_id, getAuth())
      await sapStore.recSave({
        kind: it.kind, rec_name: it.name || '', action: it.action || '',
        environ: '', env_label: '', ok_flag: '', status: '',
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
      message.error('请先在「元数据 → 表单」里填写函数名')
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

  const onSaveProfile = () => {
    saveProfile({ action: metaFuncName.trim(), config })
    message.success('已保存配置方案')
  }
  const applyProfile = (rec) => {
    updateConfig(rec.config || {})
    setProfileOpen(false)
    message.success('已应用配置方案')
  }
  const onDeleteProfile = (id) => { deleteProfile(id); message.success('已删除该方案') }
  const onClearProfiles = () => { clearProfiles(); message.success('已清空配置方案') }

  return (
    <ConfigProvider locale={zhCN}>
      {/* 纵向 Flex：上=固定工具栏（不随滚动），下=表单滚动区 */}
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

        {/* ===== 置顶工具栏 ===== */}
        <div
          style={{
            flex: '0 0 auto',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            padding: '10px 16px',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {/* 左：标题 + 接口调用参数 */}
            <Space wrap size={8}>
              <strong style={{ fontSize: 16, marginRight: 4 }}>自动生成的表单</strong>
              {/* 本地开发才显示「环境 / 用户名 / 密码」；部署到 BSP（生产构建）同源走 SAP 会话，隐藏 */}
              {IS_DEV && (
                <>
                  <span>环境：</span>
                  <AntSelect
                    value={env}
                    onChange={setEnv}
                    style={{ width: 120 }}
                    options={Object.entries(ENVIRONMENTS).map(([k, v]) => ({
                      value: k,
                      label: v.url ? v.label : `${v.label}（未配置）`,
                    }))}
                  />
                  <AntInput
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="用户名"
                    style={{ width: 130 }}
                  />
                  <AntInput.Password
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码"
                    style={{ width: 130 }}
                  />
                </>
              )}
              <span style={{ color: '#888' }}>
                将调用：{metaFuncName ? <b>{metaFuncName}</b> : '（未设置）'}
              </span>
            </Space>

            {/* 右：动作按钮 + 提交 */}
            <Space wrap size={8}>
              <Button onClick={openHistory} loading={historyLoading}>调用记录（{history.length}）</Button>
              <Button onClick={openVariants} loading={variantLoading}>变式（{variants.length}）</Button>
              <Button onClick={openInbox}>
                分享给我的（{inbox.length}{inbox.some((i) => i.read_flag !== 'X') ? ' ·新' : ''}）
              </Button>
              <Button onClick={toggleCollapseAll} disabled={!hasForm}>{allCollapsed ? '全部展开' : '全部折叠'}</Button>
              <Button onClick={openVisConfig} disabled={!hasForm}>字段显隐</Button>
              <Button onClick={openDataFill} disabled={!hasForm}>填充数据 JSON</Button>
              <Button type="primary" onClick={openMeta}>元数据 → 表单</Button>
              <Button type="primary" danger loading={submitting} disabled={!hasForm} onClick={doSubmit}>
                提交并调用 SAP
              </Button>
            </Space>
          </div>
        </div>

        {/* ===== 表单滚动区 ===== */}
        <div style={{ flex: '1 1 auto', overflow: 'auto', padding: 16 }}>
          {!hasForm && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="尚未生成表单"
              description="点右上角「元数据 → 表单」，填函数名从接口获取，或直接粘贴 Formily Schema，再点「生成表单」。"
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

        {/* ===== 弹窗 ===== */}
        <MetaModal
          open={metaOpen}
          onClose={() => setMetaOpen(false)}
          funcName={metaFuncName}
          setFuncName={setMetaFuncName}
          loading={metaLoading}
          onFetchAndGenerate={() => fetchAndGenerate()}
          aiLoading={metaAiLoading}
          onFetchAndGenerateAI={() => fetchAndGenerate({ action: SAP.metadataAiAction, ai: true })}
          envLabel={IS_DEV ? ENVIRONMENTS[env].label : ''}
          showMetaInput={metaShowInput}
          setShowMetaInput={setMetaShowInput}
          metaInputText={metaInputText}
          setMetaInputText={setMetaInputText}
          onConvertMeta={convertMetaAndGenerate}
          showJson={metaShowJson}
          setShowJson={setMetaShowJson}
          metaText={metaText}
          setMetaText={setMetaText}
          onApplyJson={applyJsonToForm}
          metaError={metaError}
        />

        <DataFillModal
          open={dataOpen}
          onClose={() => setDataOpen(false)}
          onFill={handleFill}
          dataText={dataText}
          setDataText={setDataText}
          dataError={dataError}
        />

        <HistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          history={history}
          loading={historyLoading}
          limit={STORAGE.historyLimit}
          onRestore={restoreFromHistory}
          onRename={onRenameHistory}
          onViewBody={onViewHistoryBody}
          onShare={openShare}
          onDelete={onDeleteHistory}
          onClear={onClearHistory}
          onExport={onExportHistory}
          onExportOne={onExportOne}
          onImportFile={onImportHistoryFile}
        />

        <VariantModal
          open={variantOpen}
          onClose={() => setVariantOpen(false)}
          variants={variants}
          loading={variantLoading}
          limit={STORAGE.variantLimit}
          canSave={hasForm}
          onSave={onSaveVariant}
          onRestore={restoreVariant}
          onShare={openShare}
          onDelete={onDeleteVariant}
          onClear={onClearVariants}
          onExport={onExportVariants}
          onExportOne={onExportOneVariant}
          onImportFile={onImportVariantFile}
        />

        <ShareInboxModal
          open={inboxOpen}
          onClose={() => setInboxOpen(false)}
          inbox={inbox}
          loading={inboxLoading}
          onFill={onInboxFill}
          onSaveAs={onInboxSaveAs}
          onRemove={onInboxRemove}
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
          onSaveProfile={onSaveProfile}
          onOpenProfiles={() => setProfileOpen(true)}
          profilesCount={profiles.length}
        />

        <ProfileModal
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profiles={profiles}
          limit={STORAGE.visProfileLimit}
          onApply={applyProfile}
          onDelete={onDeleteProfile}
          onClear={onClearProfiles}
        />
      </div>
    </ConfigProvider>
  )
}
