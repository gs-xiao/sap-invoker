// 动态表单生命周期 hook：管理 applied(schema) / config(显隐)，按需重建 Formily form，
// 并派生渲染用 schema、显隐树数据、勾选态。把 App 里最绕的一段状态逻辑集中在此。
import { useCallback, useMemo, useRef, useState, useDeferredValue } from 'react'
import { createForm } from '@formily/core'
import {
  stripInternalKeys, applyVisibility, buildTreeData, configToCheckedKeys,
} from '../visibility'

export function useDynamicForm() {
  const [applied, setApplied] = useState({ type: 'object', properties: {} })
  const [config, setConfig] = useState({}) // 显隐配置：只记录被隐藏的叶子
  // 上一版 schema，供「这份 Schema 渲染失败了」时退回（见 SchemaErrorBoundary）。
  // 用 state 而非 ref：canRollback 要能驱动错误卡片上的按钮显隐。
  const [prevApplied, setPrevApplied] = useState(null)

  // 显隐的「重活」（重建/重渲染表单）用 deferred 值驱动 —— 勾选框即时更新 config，
  // React 把昂贵的表单重渲染延后为非阻塞任务，大表单切显隐时勾选不卡（不改显隐机制本身）。
  const deferredConfig = useDeferredValue(config)

  // 重建 form 的时机：schema(applied) 变、或显隐配置(deferredConfig) 变。
  // Formily 字段模型按路径缓存复用，改 schema 的 x-display 后已挂载字段不会重读 display，
  // 所以显隐必须靠重建 form 才能落到普通字段上。重建时初始值优先级：
  //   1) 恢复调用记录 → 直接灌入记录里的值（避免空渲染+reset+再渲染的两遍开销）
  //   2) 仅切显隐（schema 未变）→ 继承当前已填值，避免丢数据
  //   3) 换了 schema → 空表单
  const formRef = useRef(null)
  const appliedRef = useRef(applied)
  const pendingRestoreRef = useRef(null) // 恢复调用记录时暂存要灌入的值

  const form = useMemo(() => {
    let values
    if (pendingRestoreRef.current) {
      values = pendingRestoreRef.current
      pendingRestoreRef.current = null
    } else if (appliedRef.current === applied && formRef.current) {
      values = stripInternalKeys(formRef.current.values || {})
    }
    appliedRef.current = applied
    const f = createForm(values ? { values } : undefined)
    formRef.current = f
    return f
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied, deferredConfig])

  // 显隐派生：把 config 注入 applied 得到渲染用 schema（用 deferred 值，重渲染非阻塞）
  const renderSchema = useMemo(() => applyVisibility(applied, deferredConfig), [applied, deferredConfig])
  const { treeData, allLeafKeys } = useMemo(() => buildTreeData(applied), [applied])
  // 勾选树用即时 config（保证勾选框响应），故此处不用 deferred
  const checkedKeys = useMemo(() => configToCheckedKeys(config, allLeafKeys), [config, allLeafKeys])

  // 应用新 schema（新表单从「全部显示」起步，不继承上一个 schema 的显隐配置）
  const applySchema = (schema) => {
    setPrevApplied(applied)
    setApplied(schema)
    setConfig({})
  }

  // 应用新 schema 但「保留当前状态」：把当前已填值灌进重建后的表单、并保留当前显隐配置。
  // 用于「编辑 JSON Schema → 应用到表单」——用户只想微调结构，不希望丢失已填数据与显隐设置。
  // 字段增删安全：新字段默认显示且值为空；被删字段的旧值/旧显隐 key 变成无害残留。
  const applySchemaKeepState = (schema) => {
    pendingRestoreRef.current = stripInternalKeys(formRef.current?.values || {})
    setPrevApplied(applied)
    setApplied(schema)
    // 不动 config：显隐配置原样保留
  }

  // 从调用记录恢复：把值暂存到 ref，setApplied/setConfig 触发的重建会直接把值灌进新 form
  const restore = (schema, values, cfg) => {
    pendingRestoreRef.current = values || {}
    setPrevApplied(applied)
    setApplied(schema)
    setConfig(cfg || {})
  }

  // 退回上一版 schema（渲染崩溃后的逃生口）。已填的值照旧带过去——崩的是渲染，
  // form 里的数据是好的。退回后就没有更早的版本可退了，清空 prevApplied。
  // useCallback 是为了引用稳定：它要传给 React.memo 过的 FormPane，每次新建函数会让 memo 失效。
  const rollback = useCallback(() => {
    if (!prevApplied) return
    pendingRestoreRef.current = stripInternalKeys(formRef.current?.values || {})
    setApplied(prevApplied)
    setPrevApplied(null)
  }, [prevApplied])

  return {
    applied, config, setConfig,
    form, renderSchema, treeData, allLeafKeys, checkedKeys,
    applySchema, applySchemaKeepState, restore,
    canRollback: !!prevApplied, rollback,
  }
}
