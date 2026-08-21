// 资产列表：调用记录 / 变式 / 收件箱三个 Tab 共用的行渲染。
//
// 三份列表原先是三个几乎一样的 Modal，行内动作也各挤 3~6 个 link 按钮。这里统一成
//   [标题（可就地改名）+ 若干 Tag] ────── [1~2 个主动作] [⋯ 收纳其余]
// 差异全部由调用方通过 props 注入，本组件不认识「记录/变式/分享」这些概念。
import React from 'react'
import { List, Button, Space, Dropdown, Typography } from 'antd'
import { MoreOutlined } from '@ant-design/icons'

export default function RecordList({
  loading, dataSource, emptyText, maxHeight = '52vh',
  getKey,             // (rec) => string，行 key
  getName,            // (rec) => string，标题主文案（可为空串）
  getExtra,           // (rec) => ReactNode，标题右侧的 Tag 等附加信息（可选）
  getDescription,     // (rec) => ReactNode，副标题
  onRename,           // (rec, name) => void，给了才允许点标题就地改名
  getPrimaryActions,  // (rec) => [{ key, label, onClick }]，直接铺在行尾的按钮
  getMenuActions,     // (rec) => [{ key, label, danger, onClick }]，收进 ⋯ 菜单
}) {
  return (
    <List
      size="small"
      loading={loading}
      locale={{ emptyText }}
      dataSource={dataSource}
      style={{ maxHeight, overflow: 'auto' }}
      renderItem={(rec) => {
        const primary = getPrimaryActions?.(rec) ?? []
        const menu = getMenuActions?.(rec) ?? []
        const name = getName?.(rec) ?? ''

        const actions = primary.map((a) => (
          <Button type="link" size="small" key={a.key} onClick={() => a.onClick(rec)}>{a.label}</Button>
        ))
        if (menu.length) {
          actions.push(
            <Dropdown
              key="more"
              trigger={['click']}
              menu={{
                items: menu.map(({ key, label, danger }) => ({ key, label, danger })),
                // 统一在这里派发，避免依赖 antd MenuItem 自带 onClick 的行为差异
                onClick: ({ key }) => menu.find((m) => m.key === key)?.onClick(rec),
              }}
            >
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          )
        }

        return (
          <List.Item key={getKey?.(rec)} actions={actions}>
            <List.Item.Meta
              title={
                <Space size={8} wrap>
                  {onRename ? (
                    // editable.text 让「显示文案」和「进入编辑时的初值」分开：
                    // 未命名的记录显示占位符，但一点铅笔编辑框是空的，不会把占位符当成名字存进去。
                    <Typography.Text
                      strong
                      editable={{
                        text: name,
                        tooltip: '重命名',
                        onChange: (v) => onRename(rec, v),
                      }}
                    >
                      {name || '(未命名)'}
                    </Typography.Text>
                  ) : (
                    <span style={{ fontWeight: 600 }}>{name || '(未命名)'}</span>
                  )}
                  {getExtra?.(rec)}
                </Space>
              }
              description={getDescription?.(rec)}
            />
          </List.Item>
        )
      }}
    />
  )
}
