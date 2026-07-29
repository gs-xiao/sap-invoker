// 调用记录 hook：提交后自动记录一次调用，用 localStorage 持久化。
// 底层复用 useRecordStore（Schema 去重池 + 打包导出/导入）；这里只加「组装一条调用记录」的语义。
// 导出 bundle 的 kind='call-history'、列表字段='history'，与历史导出文件格式保持兼容。
import { STORAGE } from '../config'
import { useRecordStore } from './useRecordStore'

const { historyKey, historyLimit, schemaPoolKey } = STORAGE

export function useCallHistory() {
  const store = useRecordStore({
    recordsKey: historyKey,
    poolKey: schemaPoolKey,
    limit: historyLimit,
    kind: 'call-history',
    listField: 'history',
  })

  // 组装并保存一条调用记录（schema 去重存池，恢复时按引用取回）。body=接口返回消息，全量存。
  const recordCall = ({ applied, values, ok, status, env, envLabel, action, config, body }) => {
    store.add({ schema: applied, env, envLabel, action, config, values, ok, status, body })
  }

  return {
    history: store.records,
    recordCall,
    renameCall: (id, name) => store.update(id, { name }), // 重命名一条调用记录
    deleteHistory: store.remove,
    clearHistory: store.clear,
    getSchema: store.getSchema,
    exportBundle: store.exportBundle,
    importBundle: store.importBundle,
  }
}
