// 资产（调用记录 / 变式）的通用动作：删除、清空、下载全部、下载单条、导入文件。
//
// 这五个动作原先在 App 里各写了两遍（记录一遍、变式一遍），除了名词和调用哪个 store
// 完全一样，约一百行的重复。抽成工厂后，以后再加第三类资产不用再抄。
//
// 弹窗和提示都走 antd 的 App 上下文（不是静态方法），这样二次确认框才吃得到 theme.js 里
// 那套主色和圆角。
import { useCallback } from 'react'
import { App as AntApp } from 'antd'
import { downloadJson, timestampName } from '../utils/file'

// 危险操作的二次确认。原先「清空记录/清空变式」点了就执行，反倒是可撤销得多的
// 「变式重名覆盖」有确认框，轻重是反的 —— 统一走这里。
export function useConfirmDanger() {
  const { modal } = AntApp.useApp()
  return useCallback(
    (title, content, okText) =>
      new Promise((resolve) => {
        modal.confirm({
          title, content, okText, cancelText: '取消',
          okButtonProps: { danger: true },
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        })
      }),
    [modal]
  )
}

/**
 * @param {object}   o
 * @param {string}   o.noun          名词，如「调用记录」「变式」（拼进所有文案）
 * @param {string}   o.unit          量词，「条」或「个」
 * @param {string}   o.filePrefix    下载全部时的文件名前缀
 * @param {string}   o.oneFilePrefix 下载单条时的文件名前缀
 * @param {Array}    o.list          当前列表（判空 + 数量提示用）
 * @param {object}   o.api           { refresh, remove, clear, exportAll, exportOne, importBundle }
 * @param {Function} o.labelOf       (rec) => 删除确认框里显示的名字
 * @param {Function} o.fileNameOf    (rec) => 单条下载文件名里的那段
 */
export function useAssetActions({ noun, unit, filePrefix, oneFilePrefix, list, api, labelOf, fileNameOf }) {
  const { message } = AntApp.useApp()
  const confirmDanger = useConfirmDanger()

  const onDelete = async (rec) => {
    if (!await confirmDanger(`删除${noun}`, `将删除「${labelOf(rec)}」，无法恢复。`, '删除')) return
    try { await api.remove(rec.id); await api.refresh(); message.success(`已删除该${noun}`) }
    catch (e) { message.error('删除失败：' + e.message) }
  }

  const onClear = async () => {
    if (!await confirmDanger(`清空${noun}`, `将删除全部 ${list.length} ${unit}${noun}，无法恢复。`, '清空')) return
    try { await api.clear(); await api.refresh(); message.success(`已清空${noun}`) }
    catch (e) { message.error('清空失败：' + e.message) }
  }

  const onExportAll = async () => {
    if (!list.length) { message.warning(`暂无${noun}可下载`); return }
    try {
      downloadJson(timestampName(filePrefix), await api.exportAll())
      message.success(`已下载全部${noun}`)
    } catch (e) { message.error('下载失败：' + e.message) }
  }

  const onExportOne = async (rec) => {
    try {
      // 文件名里只留 [\w.-]，中文名和空格都会被折成下划线，免得下载到一个 Windows 存不下的名字
      const safe = String(fileNameOf(rec)).replace(/[^\w.-]+/g, '_').slice(0, 40)
      downloadJson(timestampName(`${oneFilePrefix}-${safe}`), await api.exportOne(rec))
      message.success(`已下载该${noun}`)
    } catch (e) { message.error('下载失败：' + e.message) }
  }

  const onImportFile = async (file) => {
    try {
      const added = await api.importBundle(JSON.parse(await file.text()))
      message.success(`已导入 ${added} ${unit}${noun}`)
    } catch (e) { message.error('导入失败：' + e.message) }
  }

  return { onDelete, onClear, onExportAll, onExportOne, onImportFile }
}
