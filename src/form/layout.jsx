// 响应式块布局用的两个轻量组件（纯展示，无拖拽、无新依赖）。
//
// · Block：节点块容器（结构用作 x-component，表格用作 x-decorator）。渲染一张「可折叠」
//   的 antd Card，标题取字段自身的 title，点标题右侧箭头收起/展开卡片 body。
//   外层 flex-basis:100% 使每块独占一行；块内叶子字段的多列排版由子级 FormGrid 负责，
//   故 body 本身不再做 flex-wrap。
// · WidthItem：旧 schema（调用记录里恢复的）叶子装饰器。新表单已改用 FormItem + FormGrid，
//   这里保留仅为兼容——恢复引用 WidthItem 的历史记录时不至于白屏。

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { FormItem } from '@formily/antd-v5'
import { useField } from '@formily/react'
import { Card } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'
import { BRAND } from '../theme'

// 全局「全部展开/折叠」命令：App 每次点按钮广播一个新对象 { open }，所有 Block 据此同步开合。
// 缺省 null（不下命令）；单个卡片仍可各自点箭头独立开合。
export const BlockCollapseContext = createContext(null)

// 旧叶子字段：固定宽外壳 + FormItem（仅兼容历史记录，新 schema 不再产出）
export const WidthItem = ({ width = 220, children, ...rest }) => (
  <div style={{ width, flex: '0 0 auto', boxSizing: 'border-box' }}>
    <FormItem {...rest}>{children}</FormItem>
  </div>
)

// 节点块：可折叠 Card（标题=字段 title）。默认展开，点箭头收起 body。
export const Block = ({ children, title, ...rest }) => {
  const field = useField()
  const heading = title ?? field?.title
  const [open, setOpen] = useState(true)
  const command = useContext(BlockCollapseContext)
  const mounted = useRef(false)
  // 挂载时忽略当前命令（新表单默认展开）；之后每次命令变化才同步开合
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (command) setOpen(command.open)
  }, [command])
  return (
    <Card
      size="small"
      // 标题左侧一道主色竖条：底色已由主题的 Card.headerBg 统一给成浅灰，
      // 光靠底色跟白底 body 对比太弱，用竖条把「这是一个结构块」标出来。
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 3, height: 14, borderRadius: 2, background: BRAND }} />
          {heading}
        </span>
      }
      // 折叠箭头放标题右侧；点它切换展开态。收起时不渲染 body，减少大表单开销。
      extra={
        <a onClick={() => setOpen((v) => !v)} style={{ color: 'inherit' }}>
          {open ? <DownOutlined /> : <RightOutlined />}
        </a>
      }
      style={{ flexBasis: '100%', width: '100%', marginBottom: 12 }}
      styles={{
        body: { display: open ? 'block' : 'none' },
      }}
      {...rest}
    >
      {children}
    </Card>
  )
}
