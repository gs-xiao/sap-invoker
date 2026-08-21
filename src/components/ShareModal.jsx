// 分享小窗：手动填接收人 SAP 用户名 + 附言。
//
// 从 App 里搬出来的，连带把 uname / note / busy 三个 state 一起带走 —— 它们只在这个窗口里
// 用得到，留在 App 上只会让顶层 state 更长、让每次输入都惊动整个页面重渲染。
// App 那边只剩一个 target（由资产中心的「分享给同事」打开）。
//
// 本组件不碰网络：onSubmit 由 App 注入，返回 true 表示成功、窗口自动关闭。
import React, { useEffect, useState } from 'react'
import { Modal, Input as AntInput, App as AntApp } from 'antd'

export default function ShareModal({ target, onClose, onSubmit }) {
  const { message } = AntApp.useApp()
  const [uname, setUname] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // 换一条记录分享 → 清空上一次填的接收人和附言
  useEffect(() => {
    if (target) { setUname(''); setNote('') }
  }, [target])

  const submit = async () => {
    const to = uname.trim()
    if (!to) { message.error('请填写接收人 SAP 用户名'); return }
    setBusy(true)
    try {
      if (await onSubmit(to, note.trim())) onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={target ? `分享「${target.name || target.action || '记录'}」给指定人` : '分享'}
      open={!!target}
      onCancel={onClose}
      onOk={submit}
      confirmLoading={busy}
      okText="分享"
      cancelText="取消"
    >
      <div style={{ marginBottom: 6 }}>接收人 SAP 用户名：</div>
      <AntInput
        value={uname}
        onChange={(e) => setUname(e.target.value)}
        onPressEnter={submit}
        placeholder="如 ZHANGSAN（对方登录 SAP 的账号）"
        autoFocus
      />
      <div style={{ margin: '12px 0 6px' }}>附言（可选）：</div>
      <AntInput.TextArea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={100}
        placeholder="给对方留句话"
      />
    </Modal>
  )
}
