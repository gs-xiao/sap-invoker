// 调用记录弹窗：列出最近调用，可「填充」（恢复表单）、「查看返回」、「重命名」或「删除」；
// 底部可下载分享（导出 JSON）/ 导入别人分享的文件 / 清空。
import React, { useRef, useState } from 'react'
import { Modal, Space, Button, List, Tag, Input } from 'antd'

export default function HistoryModal({ open, onClose, history, limit, loading, onRestore, onRename, onViewBody, onShare, onDelete, onClear, onExport, onExportOne, onImportFile }) {
  const fileRef = useRef(null)
  const [editingId, setEditingId] = useState(null) // 正在重命名的记录 id
  const [draftName, setDraftName] = useState('')

  // 选文件后交给父级处理，然后清空 input 值（同名文件可再次选择触发）
  const handlePick = (e) => {
    const file = e.target.files?.[0]
    if (file) onImportFile?.(file)
    e.target.value = ''
  }

  const startRename = (rec) => { setEditingId(rec.id); setDraftName(rec.name || '') }
  const cancelRename = () => { setEditingId(null); setDraftName('') }
  const saveRename = (rec) => {
    onRename?.(rec.id, draftName)
    cancelRename()
  }

  return (
    <Modal
      title={`调用记录（最近 ${history.length} 条，最多存 ${limit}）`}
      open={open}
      onCancel={onClose}
      footer={
        <Space wrap>
          <Button disabled={!history.length} onClick={onExport}>下载全部</Button>
          <Button onClick={() => fileRef.current?.click()}>导入分享文件</Button>
          <Button danger disabled={!history.length} onClick={onClear}>清空记录</Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
      width={720}
    >
      {/* 隐藏的文件选择器，由「导入分享文件」按钮触发 */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handlePick}
      />
      <List
        size="small"
        loading={loading}
        locale={{ emptyText: '暂无调用记录，提交一次后会自动记录' }}
        dataSource={history}
        style={{ maxHeight: '60vh', overflow: 'auto' }}
        renderItem={(rec) => {
          const editing = rec.id === editingId
          return (
            <List.Item
              actions={
                editing
                  ? [
                      <Button type="link" key="save" onClick={() => saveRename(rec)}>保存</Button>,
                      <Button type="link" key="cancel" onClick={cancelRename}>取消</Button>,
                    ]
                  : [
                      <Button type="link" key="fill" onClick={() => onRestore(rec)}>填充</Button>,
                      <Button type="link" key="view" onClick={() => onViewBody(rec)}>查看返回</Button>,
                      <Button type="link" key="share" onClick={() => onShare(rec)}>分享</Button>,
                      <Button type="link" key="rename" onClick={() => startRename(rec)}>重命名</Button>,
                      <Button type="link" key="dl" onClick={() => onExportOne(rec)}>下载</Button>,
                      <Button type="link" danger key="del" onClick={() => onDelete(rec.id)}>删除</Button>,
                    ]
              }
            >
              <List.Item.Meta
                title={
                  editing ? (
                    <Input
                      size="small"
                      autoFocus
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onPressEnter={() => saveRename(rec)}
                      placeholder="给这条记录起个名字（留空即清除自定义名）"
                      style={{ maxWidth: 360 }}
                    />
                  ) : (
                    <Space size={8} wrap>
                      {rec.name && <span style={{ fontWeight: 600 }}>{rec.name}</span>}
                      <span style={{ color: rec.name ? '#888' : undefined }}>{rec.action || '(无 action)'}</span>
                      <Tag color="blue">{rec.envLabel || rec.env}</Tag>
                      <Tag color={rec.ok ? 'green' : 'red'}>{rec.ok ? '成功' : '失败'} {rec.status}</Tag>
                    </Space>
                  )
                }
                description={rec.time}
              />
            </List.Item>
          )
        }}
      />
    </Modal>
  )
}
