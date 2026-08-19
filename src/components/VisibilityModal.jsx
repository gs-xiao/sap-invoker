// 字段显隐配置弹窗：勾选树 / JSON 两种视图；底部快捷动作（隐藏空值、全显/全隐）。
// 显隐配置本身不单独持久化——调好后连同值与布局一起存成「变式」即可复用。
import React from 'react'
import { Modal, Space, Button, Select as AntSelect, Tree, Alert } from 'antd'

export default function VisibilityModal({
  open, onClose,
  treeData, checkedKeys, onTreeCheck,
  visView, setVisView, config,
  visJsonText, setVisJsonText, visJsonError, onApplyJson,
  onApplyHideEmpty, onShowAll, onHideAll,
}) {
  return (
    <Modal
      title="字段显隐配置"
      open={open}
      onCancel={onClose}
      width={760}
      footer={
        <Space wrap>
          <Button onClick={onApplyHideEmpty}>隐藏空值（按当前数据）</Button>
          <Button onClick={onShowAll}>全部显示</Button>
          <Button onClick={onHideAll}>全部隐藏</Button>
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      <Space style={{ marginBottom: 8 }}>
        <span>视图：</span>
        <AntSelect
          value={visView}
          onChange={(v) => {
            if (v === 'json') setVisJsonText(JSON.stringify(config, null, 2))
            setVisView(v)
          }}
          style={{ width: 160 }}
          options={[
            { value: 'tree', label: '勾选表单' },
            { value: 'json', label: 'JSON（可分享）' },
          ]}
        />
        <span style={{ color: '#888', fontSize: 12 }}>勾选=显示；取消=隐藏。被隐藏字段仍照常提交。</span>
      </Space>

      {visView === 'tree' ? (
        <div style={{ maxHeight: '58vh', overflow: 'auto', border: '1px solid #eee', borderRadius: 4, padding: 8 }}>
          {treeData.length ? (
            <Tree
              checkable
              selectable={false}
              defaultExpandAll
              treeData={treeData}
              checkedKeys={checkedKeys}
              onCheck={onTreeCheck}
            />
          ) : (
            <span style={{ color: '#888' }}>暂无字段</span>
          )}
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
            这份 JSON 就是可分享的显隐配置：只列出被隐藏的字段（缺省即显示）。改完点「应用 JSON」。
          </div>
          <textarea
            value={visJsonText}
            onChange={(e) => setVisJsonText(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%', height: '48vh', fontFamily: 'Consolas, monospace',
              fontSize: 13, resize: 'vertical', border: '1px solid #eee', padding: 8,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 8 }}>
            <Button type="primary" onClick={onApplyJson}>应用 JSON</Button>
          </div>
          {visJsonError && <Alert type="error" message={visJsonError} style={{ marginTop: 8 }} />}
        </>
      )}
    </Modal>
  )
}
