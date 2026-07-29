// 变式 hook（kind='VAR'）：手动保存「当前表单的完整状态」并命名，之后一键回填。
// 变式 = 名字 + 字段值 + Schema(布局) + 显隐配置；底层复用 SAP 后端存储 useRecordStore。
// getAuth 由 App 传入（返回 { env, username, password }）。
import { useRecordStore } from './useRecordStore'

export function useVariants(getAuth) {
  const s = useRecordStore({ kind: 'VAR', getAuth })
  return {
    variants: s.records,
    loading: s.loading,
    refresh: s.refresh,
    // 保存一个变式：{ name, applied(=schema), values, config, action }
    saveVariant: ({ name, applied, values, config, action }) =>
      s.add({ rec_name: name, schema: applied, values, config, action }),
    deleteVariant: s.remove,
    clearVariants: s.clear,
    getFull: s.getFull,
    exportAll: s.exportAll,
    exportOne: s.exportOne,
    importBundle: s.importBundle,
  }
}
