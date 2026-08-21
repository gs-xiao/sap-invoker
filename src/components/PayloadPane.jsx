// 「请求 Body」页：实时预览当前表单会提交给 SAP 的入参 JSON，也可以反向手改 JSON 回填表单。
//
// 两个设计点：
//  · 实时性：订阅 form 的生命周期事件重渲染。只在本页可见时(active)订阅——Tab 面板始终挂载着
//    （切走不销毁，见 App 的 Tabs），不加这个开关的话在表单页每敲一个字都会整份 stringify 一遍。
//  · 脏数据保护：draft 为 null 表示「跟随表单实时刷新」，非 null 表示用户正在手改。
//    没有这层，用户粘到一半的 JSON 会被下一次表单变更冲掉。
import React, { useEffect, useReducer, useRef, useState } from 'react'
import { Button, Alert, Space, Tag, App as AntApp } from 'antd'
import JsonEditor from './JsonEditor'
import { stripInternalKeys } from '../visibility'

export default function PayloadPane({ form, active, onFill, disabled }) {
  const { message } = AntApp.useApp()
  const [, bump] = useReducer((x) => x + 1, 0)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!active) return
    const id = form.subscribe(() => bump())
    return () => form.unsubscribe(id)
  }, [form, active])

  // 表单被整体重建（重新生成 / 恢复记录）时，手改到一半的草稿已经对不上新结构了，丢弃
  const formRef = useRef(form)
  useEffect(() => {
    if (formRef.current !== form) {
      formRef.current = form
      setDraft(null)
      setError('')
    }
  }, [form])

  // 只在本页可见时才序列化。订阅那道开关只挡住了「表单变更触发的重渲染」，挡不住 App
  // 自身的重渲染（顶栏敲个函数名就是一次）——面板始终挂载着，不加这个判断照样每次都把
  // 整份 values stringify 一遍。不可见时文本没人看得到，给空串即可，切回来自然重算。
  const live = active ? JSON.stringify(stripInternalKeys(form.values ?? {}), null, 2) : ''
  const dirty = draft !== null
  const text = dirty ? draft : live

  const handleSync = async () => {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setError('JSON 解析失败：' + e.message)
      return
    }
    try {
      await onFill(parsed)
      setDraft(null) // 回到实时模式
      setError('')
      message.success('已按 JSON 填充表单')
    } catch (e) {
      setError('填充失败：' + e.message)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制到剪贴板')
    } catch { message.error('复制失败，请手动选中复制') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <Space wrap>
        {dirty
          ? <Tag color="orange">已手动编辑（不再跟随表单）</Tag>
          : <Tag color="green">实时跟随表单</Tag>}
        <span style={{ color: '#888', fontSize: 12 }}>
          这就是点「提交并调用 SAP」时发给函数的入参；被隐藏的字段照样提交。
        </span>
      </Space>

      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        <JsonEditor
          value={text}
          onChange={disabled ? undefined : setDraft}
          readOnly={disabled}
          placeholder="尚未生成表单"
        />
      </div>

      {error && <Alert type="error" message={error} />}

      <Space wrap>
        <Button type="primary" disabled={disabled} onClick={handleSync}>同步 Body 至表单 ▶</Button>
        <Button onClick={handleCopy} disabled={disabled}>复制 JSON</Button>
        <Button disabled={!dirty} onClick={() => { setDraft(null); setError('') }}>重置为当前表单</Button>
      </Space>
    </div>
  )
}
