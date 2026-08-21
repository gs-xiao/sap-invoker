// 字段显隐配置弹窗：勾选树 / JSON 两种视图；底部快捷动作（隐藏空值、全显/全隐）。
// 显隐配置本身不单独持久化——调好后连同值与布局一起存成「变式」即可复用。
// 注意这里没有「保存 / 确定」按钮：勾选是即时生效的（onTreeCheck 直接更新 config），
// 加一个只会关窗的「保存配置」反而让人以为存在别处了。
//
// 视图切换和 JSON 文本框都是本地状态。原先这三个 state（视图 / 文本 / 报错）挂在 App 上，
// 于是在这个框里敲 JSON 会一路惊动整个页面重渲；而 App 那边除了透传也没别的用处。
// 现在 App 只管 config 这一份真实数据，文本表示由本组件自己维护。
import React, { useEffect, useRef, useState } from 'react'
import { Modal, Space, Button, Select as AntSelect, Tree, Alert } from 'antd'
import JsonEditor from './JsonEditor'

export default function VisibilityModal({
  open, onClose,
  treeData, checkedKeys, onTreeCheck,
  config, onApplyConfig,
  onApplyHideEmpty, onShowAll, onHideAll,
}) {
  const [view, setView] = useState('tree')
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')

  // 每次打开都回到勾选视图（JSON 是给高级用法的，不该成为默认落点）
  useEffect(() => {
    if (open) { setView('tree'); setJsonError('') }
  }, [open])

  // JSON 文本跟随 config：勾选树、隐藏空值、全显/全隐改完 config 后，切到 JSON 视图看到的
  // 就是最新配置。唯独「点应用 JSON」这一次要跳过——那是文本反向驱动 config，再同步回来
  // 只会把用户刚敲的排版重新格式化一遍。
  const selfApplied = useRef(false)
  useEffect(() => {
    if (selfApplied.current) { selfApplied.current = false; return }
    setJsonText(JSON.stringify(config, null, 2))
  }, [config, open])

  const applyJson = () => {
    let parsed
    try {
      parsed = JSON.parse(jsonText)
    } catch (e) {
      setJsonError('JSON 解析失败：' + e.message)
      return
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setJsonError('配置必须是一个 JSON 对象')
      return
    }
    selfApplied.current = true
    setJsonError('')
    onApplyConfig(parsed)
  }

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
          value={view}
          onChange={setView}
          style={{ width: 160 }}
          options={[
            { value: 'tree', label: '勾选表单' },
            { value: 'json', label: 'JSON（可分享）' },
          ]}
        />
        <span style={{ color: '#888', fontSize: 12 }}>勾选=显示；取消=隐藏。被隐藏字段仍照常提交。</span>
      </Space>

      {view === 'tree' ? (
        <div style={{ maxHeight: '58vh', overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8, padding: 8 }}>
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
          <JsonEditor value={jsonText} onChange={setJsonText} height="48vh" />
          <div style={{ marginTop: 8 }}>
            <Button type="primary" onClick={applyJson}>应用 JSON</Button>
          </div>
          {jsonError && <Alert type="error" message={jsonError} style={{ marginTop: 8 }} />}
        </>
      )}
    </Modal>
  )
}
