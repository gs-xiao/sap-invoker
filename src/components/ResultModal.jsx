// 接口返回结果弹窗：展示状态 + 格式化后的响应体。
// body 存的是紧凑 JSON（无换行，便于经 SAP 往返而不被转义破坏），这里显示时才美化。
import React from 'react'
import { Modal, Button, Alert } from 'antd'

// 尽量把紧凑 JSON 字符串美化成带缩进的多行；不是 JSON 就原样返回。
function prettify(body) {
  if (typeof body !== 'string') return body
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

export default function ResultModal({ open, onClose, result }) {
  return (
    <Modal
      title="接口返回"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={720}
    >
      {result && (
        <>
          <Alert
            type={result.ok ? 'success' : 'error'}
            message={`状态：${result.status}`}
            style={{ marginBottom: 8 }}
          />
          <pre
            style={{
              maxHeight: '60vh', overflow: 'auto', background: '#f5f5f5',
              padding: 12, borderRadius: 4, fontSize: 13,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0,
            }}
          >
            {prettify(result.body)}
          </pre>
        </>
      )}
    </Modal>
  )
}
