// 顶栏的环境 chip：点开是「环境 / 用户名 / 密码」。
//
// 这三样只在本地开发（npm run dev）下有意义——打包部署到 BSP 后前端与 SAP 同源，
// 走的是浏览器已有的 SAP 会话，没有账号密码可填，环境也固定是生产。所以生产构建下
// chip 退化成一个纯展示的标签，不可点。
//
// 弹层里改的是**草稿**，点「应用并连接」才提交给上层并真正生效。理由：
// 密码是逐字符输入的，绑到全局 state 上意味着敲一半的密码随时可能被下一次请求用掉；
// 而且没有提交动作的话，用户填完账号看到列表还是空的（挂载时那次拉取用的是空账号），
// 会以为没生效。现在这个按钮同时承担「保存」和「测一下通不通」两件事。
import React, { useEffect, useState } from 'react'
import { Popover, Select as AntSelect, Input as AntInput, Tag, Space, Button } from 'antd'
import { DownOutlined } from '@ant-design/icons'
import { ENVIRONMENTS, IS_DEV } from '../config'

export default function ConnectionPopover({ env, username, password, onApply, applying }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({ env, username, password })

  // 每次打开都从当前生效值重新起草：中途关掉的半截输入不留存；
  // 另外「填充调用记录」会从外部改 env（切回记录当时的环境），这里也要跟上。
  useEffect(() => {
    if (open) setDraft({ env, username, password })
  }, [open, env, username, password])

  const label = ENVIRONMENTS[env]?.label || env
  const configured = !!ENVIRONMENTS[env]?.url

  const chip = (
    <Tag
      color={configured ? 'blue' : 'red'}
      style={{ margin: 0, cursor: IS_DEV ? 'pointer' : 'default', userSelect: 'none' }}
    >
      <Space size={4}>
        {label}{configured ? '' : '（未配置）'}
        {IS_DEV && <DownOutlined style={{ fontSize: 9 }} />}
      </Space>
    </Tag>
  )

  if (!IS_DEV) return chip

  const submit = async () => {
    const ok = await onApply(draft)
    if (ok) setOpen(false) // 连不上就把弹层留着，方便直接改
  }

  return (
    <Popover
      trigger="click"
      placement="bottomLeft"
      title="连接设置"
      open={open}
      onOpenChange={setOpen}
      content={
        <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AntSelect
            value={draft.env}
            onChange={(v) => setDraft((d) => ({ ...d, env: v }))}
            options={Object.entries(ENVIRONMENTS).map(([k, v]) => ({
              value: k,
              label: v.url ? v.label : `${v.label}（未配置）`,
            }))}
          />
          <AntInput
            value={draft.username}
            onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
            placeholder="SAP 用户名"
            autoComplete="off"
          />
          <AntInput.Password
            value={draft.password}
            onChange={(e) => setDraft((d) => ({ ...d, password: e.target.value }))}
            onPressEnter={submit}
            placeholder="密码"
            autoComplete="off"
          />
          <Button type="primary" loading={applying} onClick={submit}>
            应用并连接
          </Button>
          <span style={{ color: '#888', fontSize: 12 }}>
            点击后才生效，并会用新账号重新拉取记录/变式/分享，顺带验证能不能连上。
            仅本地开发需要；部署到 BSP 后走 SAP 会话，这里会自动隐藏。
          </span>
        </div>
      }
    >
      {chip}
    </Popover>
  )
}
