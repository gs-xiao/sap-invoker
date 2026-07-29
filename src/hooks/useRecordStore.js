// 通用「带 Schema 去重池 + 打包导出/导入」的记录存储核心。
// 调用记录 useCallHistory 与 变式 useVariants 共用它——两者都是「一批引用了大 Schema 的记录」，
// 逻辑完全一致：记录只存 schemaId，整份 schema 去重存池，导出时只带被引用的那几份。
//
// 单条记录形状（各调用方自行补业务字段）：
//   { id, time, schemaId, ...业务字段（如 action/config/values/name/ok/status） }
import { useRef, useState } from 'react'

const loadJson = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
const saveJson = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch { /* 超配额等，忽略 */ }
}

// djb2 字符串哈希；id 再拼上长度进一步降低碰撞概率
function schemaId(schema) {
  const s = JSON.stringify(schema)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return `s${h.toString(36)}_${s.length}`
}
// 从 id 前缀解析时间戳（用于导入合并后按时间倒序）
const tsOf = (id) => {
  const n = parseInt(String(id).split('-')[0], 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * @param {object} opts
 *   recordsKey  localStorage 记录列表键
 *   poolKey     localStorage schema 池键
 *   limit       记录条数上限
 *   kind        导出/导入的 bundle 类型标识（也用于校验导入文件）
 *   listField   bundle 里存放记录数组的字段名（历史用 'history'，变式用 'variants'）
 */
export function useRecordStore({ recordsKey, poolKey, limit, kind, listField }) {
  const [records, setRecords] = useState(() => loadJson(recordsKey, []))
  const poolRef = useRef(loadJson(poolKey, {}))

  const savePool = () => saveJson(poolKey, poolRef.current)
  // 清掉池里不再被任何记录引用的 schema，避免池无限增长
  const prunePool = (list) => {
    const used = new Set(list.map((r) => r.schemaId).filter(Boolean))
    for (const k of Object.keys(poolRef.current)) if (!used.has(k)) delete poolRef.current[k]
    savePool()
  }

  // 新增一条记录：schema 去重存池，记录只留 schemaId。
  // fields 里的 schema 字段会被抽出入池；其余字段原样进记录。返回生成的 id。
  const add = ({ schema, ...fields }) => {
    const sid = schemaId(schema)
    if (!poolRef.current[sid]) poolRef.current[sid] = schema
    const id = `${new Date().getTime()}-${records.length}`
    const entry = { id, time: new Date().toLocaleString('zh-CN'), schemaId: sid, ...fields }
    setRecords((prev) => {
      const next = [entry, ...prev].slice(0, limit)
      saveJson(recordsKey, next)
      prunePool(next)
      return next
    })
    return id
  }

  const remove = (id) => {
    setRecords((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveJson(recordsKey, next)
      prunePool(next)
      return next
    })
  }

  // 就地更新一条记录的业务字段（如重命名 name）。不涉及 schema 池，故不 prune。
  const update = (id, patch) => {
    setRecords((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
      saveJson(recordsKey, next)
      return next
    })
  }

  const clear = () => {
    setRecords([])
    saveJson(recordsKey, [])
    poolRef.current = {}
    savePool()
  }

  // 取记录对应的 schema：新记录从池里按 schemaId 取，旧记录仍内联 rec.schema；都无返回 null
  const getSchema = (rec) => rec.schema || poolRef.current[rec.schemaId] || null

  // 导出打包：记录 + 它们引用的 schema（只带被引用的，避免把整份池导出）。
  // list 缺省=全部；传入子集（如 [rec]）即可只导出选中的那一条。
  const exportBundle = (list = records) => {
    const schemas = {}
    for (const r of list) {
      if (r.schemaId && poolRef.current[r.schemaId]) schemas[r.schemaId] = poolRef.current[r.schemaId]
    }
    return {
      app: 'formily-demo',
      kind,
      version: 1,
      exportedAt: new Date().toLocaleString('zh-CN'),
      count: list.length,
      [listField]: list,
      schemas,
    }
  }

  // 导入合并：并入现有记录（按 id 去重，schema 并回池，按时间倒序截断到上限）。
  // 非破坏性——已有记录不丢；返回新增条数。格式不对则抛错。
  const importBundle = (data) => {
    const incoming = data && Array.isArray(data[listField]) ? data[listField] : null
    if (!data || data.kind !== kind || !incoming) {
      throw new Error('文件格式不对（不是本工具导出的对应类型文件）')
    }
    const incomingSchemas = data.schemas && typeof data.schemas === 'object' ? data.schemas : {}
    let added = 0
    setRecords((prev) => {
      const existingIds = new Set(prev.map((r) => r.id))
      const fresh = incoming.filter((r) => r && r.id && !existingIds.has(r.id))
      added = fresh.length
      for (const [k, v] of Object.entries(incomingSchemas)) {
        if (!poolRef.current[k]) poolRef.current[k] = v // 池里已有则不覆盖
      }
      const merged = [...fresh, ...prev].sort((a, b) => tsOf(b.id) - tsOf(a.id)).slice(0, limit)
      saveJson(recordsKey, merged)
      prunePool(merged)
      return merged
    })
    return added
  }

  return { records, add, remove, update, clear, getSchema, exportBundle, importBundle }
}
