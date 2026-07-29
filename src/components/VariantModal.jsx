// 变式弹窗：保存/管理「命名的表单状态」。
// 顶部：给当前表单起名并「保存为变式」；列表：每个变式可 填充(回填) / 下载(分享) / 删除；
// 底部：下载全部 / 导入分享文件 / 清空。回填等同调用记录的填充（连布局+显隐一起还原）。
import React, { useRef, useState } from 'react'
import { Modal, Space, Button, List, Input as AntInput } from 'antd'

export default function VariantModal({
  open, onClose, variants, limit, canSave, loading,
  onSave, onRestore, onShare, onDelete, onClear, onExport, onExportOne, onImportFile,
}) {
  const fileRef = useRef(null)
  const [name, setName] = useState('')

  const handlePick = (e) => {
    const file = e.target.files?.[0]
    if (file) onImportFile?.(file)
    e.target.value = ''
  }

  const handleSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName('')
  }

  return (
    <Modal
      title={`变式（已存 ${variants.length}，最多 ${limit}）`}
      open={open}
      onCancel={onClose}
      footer={
        <Space wrap>
          <Button disabled={!variants.length} onClick={onExport}>下载全部</Button>
          <Button onClick={() => fileRef.current?.click()}>导入分享文件</Button>
          <Button danger disabled={!variants.length} onClick={onClear}>清空变式</Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
      width={720}
    >
      {/* 保存当前表单为一个命名变式 */}
      <Space style={{ marginBottom: 12 }} wrap>
        <AntInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          onPressEnter={handleSave}
          placeholder="给当前填写起个名字，如：华东采购模板"
          style={{ width: 300 }}
          disabled={!canSave}
        />
        <Button type="primary" disabled={!canSave || !name.trim()} onClick={handleSave}>
          保存为变式
        </Button>
        {!canSave && <span style={{ color: '#888', fontSize: 12 }}>先生成表单后才能保存变式</span>}
      </Space>

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
        locale={{ emptyText: '暂无变式，填好表单后在上方起名保存' }}
        dataSource={variants}
        style={{ maxHeight: '55vh', overflow: 'auto' }}
        renderItem={(rec) => (
          <List.Item
            actions={[
              <Button type="link" key="fill" onClick={() => onRestore(rec)}>填充</Button>,
              <Button type="link" key="share" onClick={() => onShare(rec)}>分享</Button>,
              <Button type="link" key="dl" onClick={() => onExportOne(rec)}>下载</Button>,
              <Button type="link" danger key="del" onClick={() => onDelete(rec.id)}>删除</Button>,
            ]}
          >
            <List.Item.Meta
              title={rec.name || '(未命名)'}
              description={`${rec.action || '(无 action)'} · ${rec.time}`}
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
