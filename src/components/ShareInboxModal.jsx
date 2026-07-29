// 「分享给我的」收件箱弹窗：列出别人分享给我的记录/变式（引用式，不占我的额度）。
// 每条可：填充（还原到表单）/ 另存为我的（复制成自己的，占额度）/ 移除。全用 antd 现成组件。
import React from 'react'
import { Modal, Button, List, Tag, Space } from 'antd'

export default function ShareInboxModal({ open, onClose, inbox, loading, onFill, onSaveAs, onRemove }) {
  return (
    <Modal
      title={`分享给我的（${inbox.length}）`}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={720}
    >
      <List
        size="small"
        loading={loading}
        locale={{ emptyText: '暂无收到的分享' }}
        dataSource={inbox}
        style={{ maxHeight: '60vh', overflow: 'auto' }}
        renderItem={(it) => (
          <List.Item
            actions={[
              <Button type="link" key="fill" onClick={() => onFill(it)}>填充</Button>,
              <Button type="link" key="save" onClick={() => onSaveAs(it)}>另存为我的</Button>,
              <Button type="link" danger key="rm" onClick={() => onRemove(it)}>移除</Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space size={8} wrap>
                  {it.read_flag !== 'X' && <Tag color="red">新</Tag>}
                  <span style={{ fontWeight: 600 }}>{it.name || '(未命名)'}</span>
                  <Tag color={it.kind === 'VAR' ? 'purple' : 'blue'}>{it.kind === 'VAR' ? '变式' : '调用记录'}</Tag>
                  {it.action && <span style={{ color: '#888' }}>{it.action}</span>}
                </Space>
              }
              description={`来自 ${it.from_uname}　${it.time}${it.note ? '　· ' + it.note : ''}`}
            />
          </List.Item>
        )}
      />
    </Modal>
  )
}
