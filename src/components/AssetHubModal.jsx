// 数据资产中心：把原来的「调用记录 / 变式 / 分享给我的」三个弹窗合成一个，用 Tab 切换。
//
// 三者本质是同一张后端表（ZINVOKER_REC）的不同视图，拆成三个顶栏按钮 + 三个弹窗属于重复。
// 合并后要注意一点：底部的「下载全部 / 导入 / 清空」必须跟着当前 Tab 走，
// 否则在变式页点「清空」却清掉调用记录。收件箱里的东西不是自己的，整组底部动作隐藏。
import React, { useRef, useState } from 'react'
import { Modal, Space, Button, Tabs, Tag, Input as AntInput, Badge } from 'antd'
import RecordList from './RecordList'

export default function AssetHubModal({ open, onClose, history, variants, inbox }) {
  const [tab, setTab] = useState('hist')
  const [variantName, setVariantName] = useState('')
  const fileRef = useRef(null)

  // 当前 Tab 对应的一组「批量」能力；收件箱没有（不是自己的数据）
  const bulk = tab === 'hist' ? history : tab === 'var' ? variants : null

  // 选完文件交给当前 Tab 的导入处理，再清空 input（同名文件可再次选择触发 change）
  const handlePick = (e) => {
    const file = e.target.files?.[0]
    if (file) bulk?.onImportFile?.(file)
    e.target.value = ''
  }

  // 保存成功才清空输入框：重名弹窗里选了「取消」时，用户刚敲的名字要留着
  const handleSaveVariant = async () => {
    const trimmed = variantName.trim()
    if (!trimmed) return
    if (await variants.onSave(trimmed)) setVariantName('')
  }

  const unread = inbox.list.filter((i) => i.read_flag !== 'X').length

  const histPane = (
    <RecordList
      loading={history.loading}
      dataSource={history.list}
      emptyText="暂无调用记录，提交一次后会自动记录"
      getKey={(r) => r.id}
      getName={(r) => r.name || ''}
      onRename={(r, name) => history.onRename(r.id, name)}
      getExtra={(r) => (
        <>
          <span style={{ color: '#888' }}>{r.action || '(无 action)'}</span>
          {r.envLabel || r.env ? <Tag color="blue">{r.envLabel || r.env}</Tag> : null}
          {/* 没有状态的记录（比如从别人的分享另存过来的）不要一律标红「失败」——
              我们只是不知道对方那次调用的结果，不代表它失败了。 */}
          {r.status
            ? <Tag color={r.ok ? 'green' : 'red'}>{r.ok ? '成功' : '失败'} {r.status}</Tag>
            : <Tag>状态未知</Tag>}
        </>
      )}
      getDescription={(r) => r.time}
      getPrimaryActions={() => [
        { key: 'fill', label: '填充', onClick: history.onFill },
        { key: 'view', label: '查看返回', onClick: history.onViewBody },
      ]}
      getMenuActions={() => [
        { key: 'share', label: '分享给同事', onClick: history.onShare },
        { key: 'dl', label: '下载此条', onClick: history.onExportOne },
        { key: 'del', label: '删除', danger: true, onClick: history.onDelete },
      ]}
    />
  )

  const varPane = (
    <>
      {/* 把当前表单（值 + 结构 + 显隐）存成一个命名变式 */}
      <Space style={{ marginBottom: 12 }} wrap>
        <AntInput
          value={variantName}
          onChange={(e) => setVariantName(e.target.value)}
          onPressEnter={handleSaveVariant}
          placeholder="给当前填写起个名字，如：华东采购模板"
          style={{ width: 300 }}
          disabled={!variants.canSave}
        />
        <Button type="primary" disabled={!variants.canSave || !variantName.trim()} onClick={handleSaveVariant}>
          保存为变式
        </Button>
        {!variants.canSave && <span style={{ color: '#888', fontSize: 12 }}>先生成表单后才能保存变式</span>}
      </Space>

      <RecordList
        loading={variants.loading}
        dataSource={variants.list}
        emptyText="暂无变式，填好表单后在上方起名保存"
        maxHeight="46vh"
        getKey={(r) => r.id}
        getName={(r) => r.name || ''}
        getDescription={(r) => `${r.action || '(无 action)'} · ${r.time}`}
        getPrimaryActions={() => [{ key: 'fill', label: '填充', onClick: variants.onFill }]}
        getMenuActions={() => [
          { key: 'share', label: '分享给同事', onClick: variants.onShare },
          { key: 'dl', label: '下载此条', onClick: variants.onExportOne },
          { key: 'del', label: '删除', danger: true, onClick: variants.onDelete },
        ]}
      />
    </>
  )

  const inboxPane = (
    <RecordList
      loading={inbox.loading}
      dataSource={inbox.list}
      emptyText="暂无收到的分享"
      getKey={(it) => it.share_id}
      getName={(it) => it.name || ''}
      getExtra={(it) => (
        <>
          {it.read_flag !== 'X' && <Tag color="red">新</Tag>}
          <Tag color={it.kind === 'VAR' ? 'purple' : 'blue'}>{it.kind === 'VAR' ? '变式' : '调用记录'}</Tag>
          {it.action && <span style={{ color: '#888' }}>{it.action}</span>}
        </>
      )}
      getDescription={(it) => `来自 ${it.from_uname}　${it.time}${it.note ? '　· ' + it.note : ''}`}
      getPrimaryActions={() => [{ key: 'fill', label: '填充', onClick: inbox.onFill }]}
      getMenuActions={() => [
        // 「另存为我的」不可省：分享是引用式的，对方删掉这条我这边就没了，
        // 想长期留着必须复制一份成自己的（调用记录仍存成调用记录，不会降级成变式）。
        { key: 'saveas', label: '另存为我的', onClick: inbox.onSaveAs },
        { key: 'rm', label: '移除', danger: true, onClick: inbox.onRemove },
      ]}
    />
  )

  return (
    <Modal
      title="数据资产中心"
      open={open}
      onCancel={onClose}
      width={760}
      footer={
        <Space wrap>
          {bulk && (
            <>
              <Button disabled={!bulk.list.length} onClick={bulk.onExportAll}>下载全部</Button>
              <Button onClick={() => fileRef.current?.click()}>导入分享文件</Button>
              <Button danger disabled={!bulk.list.length} onClick={bulk.onClear}>
                {tab === 'hist' ? '清空记录' : '清空变式'}
              </Button>
            </>
          )}
          <Button onClick={onClose}>关闭</Button>
        </Space>
      }
    >
      {/* 隐藏的文件选择器，由底部「导入分享文件」触发，导入目标随当前 Tab */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={handlePick}
      />

      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'hist', label: `调用记录（${history.list.length}）`, children: histPane },
          { key: 'var', label: `变式（${variants.list.length}）`, children: varPane },
          {
            key: 'inbox',
            children: inboxPane,
            label: (
              <Badge count={unread} size="small" offset={[8, -2]}>
                分享给我的（{inbox.list.length}）
              </Badge>
            ),
          },
        ]}
      />
    </Modal>
  )
}
