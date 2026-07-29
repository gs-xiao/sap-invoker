// SAP 后端存储 hook（替代原 localStorage + Schema 去重池版）。
// 记录统一存在 SAP 的 ZINVOKER_REC 表，经 Z_INVOKER_STORE（按 op 分派）读写：
//   · records = 轻量元信息列表（不含 schema/values/body），弹窗打开时异步拉取；
//   · 完整数据（schema/values/config/body）按需 getFull(id) 单条拉取（填充/查看/导出时）。
// 调用记录 useCallHistory(kind='HIST') 与 变式 useVariants(kind='VAR') 共用它。
import { useState, useCallback } from 'react'
import { store as api } from '../api/sapClient'

// 后端 list 项 { id,name,action,environ,env_label,ok,status,time } → 前端记录形状
function mapItem(kind, it) {
  return {
    id: it.id,
    name: it.name || '',
    action: it.action || '',
    env: it.environ || '',
    envLabel: it.env_label || '',
    ok: it.ok === 'X' || it.ok === true,
    status: it.status || '',
    time: it.time || '',
    kind,
  }
}
const bundleKind = (kind) => (kind === 'HIST' ? 'call-history' : 'variant')

export function useRecordStore({ kind, getAuth }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  // 拉取列表（弹窗打开 / 变更后调用）
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.recList(kind, getAuth())
      setRecords(Array.isArray(list) ? list.map((it) => mapItem(kind, it)) : [])
    } finally {
      setLoading(false)
    }
  }, [kind, getAuth])

  // 新增/保存一条：fields = { rec_name, action, env, envLabel, ok, status, schema, values, config, body }
  // schema/values/config/body 合并成 payload 一个 JSON 字符串存入后端 PAYLOAD_JSON。
  const add = async (fields) => {
    const payloadObj = {
      schema: fields.schema ?? null,
      values: fields.values ?? {},
      config: fields.config ?? {},
    }
    if (fields.body !== undefined) payloadObj.body = fields.body
    const res = await api.recSave({
      kind,
      rec_name: fields.rec_name ?? '',
      action: fields.action ?? '',
      environ: fields.env ?? '',
      env_label: fields.envLabel ?? '',
      ok_flag: fields.ok ? 'X' : '',
      status: fields.status != null ? String(fields.status) : '',
      payload: JSON.stringify(payloadObj),
    }, getAuth())
    return res?.rec_id
  }

  const rename = (id, name) => api.recRename(id, name, getAuth())
  const remove = (id) => api.recDelete(id, getAuth())
  const clear = () => api.recClear(kind, getAuth())
  const getFull = (id) => api.recGet(id, getAuth()) // → { schema, values, config, body }

  // 导出：拉全量（含 payload）打成自包含 bundle
  const exportAll = async () => {
    const out = []
    for (const r of records) {
      const payload = await getFull(r.id)
      out.push({ ...r, payload })
    }
    return { app: 'sap-invoker', kind: bundleKind(kind), version: 2, records: out }
  }
  const exportOne = async (rec) => {
    const payload = await getFull(rec.id)
    return { app: 'sap-invoker', kind: bundleKind(kind), version: 2, records: [{ ...rec, payload }] }
  }

  // 导入：逐条 recSave 成自己的新记录。兼容旧 localStorage 导出格式（history/variants + schemas 池）。
  const importBundle = async (data) => {
    let list = null
    if (Array.isArray(data?.records)) {
      list = data.records.map((r) => ({ ...r, payload: r.payload || {} }))
    } else if (Array.isArray(data?.history) || Array.isArray(data?.variants)) {
      const legacy = data.history || data.variants
      const pool = data.schemas || {}
      list = legacy.map((r) => ({
        name: r.name, action: r.action, env: r.env, envLabel: r.envLabel, ok: r.ok, status: r.status,
        payload: {
          schema: r.schema || pool[r.schemaId] || null,
          values: r.values || {},
          config: r.config || {},
          ...(r.body !== undefined ? { body: r.body } : {}),
        },
      }))
    }
    if (!list) throw new Error('文件格式不对（不是本工具导出的文件）')

    let added = 0
    for (const r of list) {
      await add({
        rec_name: r.name || '', action: r.action, env: r.env, envLabel: r.envLabel,
        ok: r.ok, status: r.status,
        schema: r.payload?.schema, values: r.payload?.values, config: r.payload?.config, body: r.payload?.body,
      })
      added++
    }
    await refresh()
    return added
  }

  return { records, loading, refresh, add, rename, remove, clear, getFull, exportAll, exportOne, importBundle }
}
