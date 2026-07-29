// 调用记录 hook（kind='HIST'）：底层复用 SAP 后端存储 useRecordStore。
// getAuth 由 App 传入（返回 { env, username, password }），供底层调接口时取当前认证参数。
import { useRecordStore } from './useRecordStore'

export function useCallHistory(getAuth) {
  const s = useRecordStore({ kind: 'HIST', getAuth })
  return {
    history: s.records,
    loading: s.loading,
    refresh: s.refresh,
    // 提交后记一条：f = { applied(=schema), values, config, body, ok, status, env, envLabel, action }
    recordCall: (f) => s.add({
      schema: f.applied, values: f.values, config: f.config, body: f.body,
      ok: f.ok, status: f.status, env: f.env, envLabel: f.envLabel, action: f.action, rec_name: '',
    }),
    renameCall: (id, name) => s.rename(id, name),
    deleteHistory: s.remove,
    clearHistory: s.clear,
    getFull: s.getFull,
    exportAll: s.exportAll,
    exportOne: s.exportOne,
    importBundle: s.importBundle,
  }
}
