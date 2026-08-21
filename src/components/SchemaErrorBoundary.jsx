// 表单渲染的兜底：Schema 页鼓励用户手写/粘贴 Formily Schema，JSON.parse 那关有 try/catch，
// 但**渲染阶段**抛错没人接——一个结构不合法的 schema 会让整个 App 卸载成白屏，已填的值、
// 变式草稿全没了，只能刷新重来。这里把它挡在表单面板内：崩了只塌这一块，其余 UI 照常，
// 并给一个「退回上一版 Schema」把人捞回去。
//
// 必须是 class：React 目前只有 componentDidCatch / getDerivedStateFromError 这对 class API
// 能捕获渲染期异常，没有等价的 hook。
import React from 'react'
import { Alert, Button, Space, Typography } from 'antd'

export default class SchemaErrorBoundary extends React.Component {
  state = { error: null, key: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  // resetKey（传当前 renderSchema 的对象引用即可）一变就说明换了一份 schema，
  // 清掉错误重新尝试渲染。退回上一版之所以能生效，靠的就是这里。
  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey }
    return null
  }

  componentDidCatch(error, info) {
    console.error('[SchemaErrorBoundary] 表单渲染失败', error, info)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <Alert
        type="error"
        showIcon
        message="这份 Schema 渲染失败了"
        description={
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <span>
              表单没能画出来，多半是结构不合法（比如 properties 写成了数组、x-component
              引用了未注册的控件）。已填的值还在，换一份能渲染的 Schema 就会恢复。
            </span>
            <Typography.Text code copyable style={{ fontSize: 12 }}>
              {String(error?.message || error)}
            </Typography.Text>
            {this.props.canRollback && (
              <Button size="small" onClick={this.props.onRollback}>
                退回上一版 Schema
              </Button>
            )}
          </Space>
        }
      />
    )
  }
}
