import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, App as AntApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import 'antd/dist/reset.css'

import App from './App.jsx'
import { theme } from './theme'

// ConfigProvider 从 App.jsx 提到这里，是为了能在它内侧再套一层 antd 的 <App>。
//
// 起因：antd v5 的静态方法（message.success / Modal.confirm）不消费 React 上下文，
// 拿不到 ConfigProvider 里那套主色和圆角 —— 二次确认框的按钮一直是 antd 默认蓝
// #1677ff，跟 theme.js 里的品牌色对不上，控制台还常驻一条 warning。
// 套上 <App> 之后，组件内改用 App.useApp() 取 message / modal 即可吃到主题与 locale。
//
// component={false}：不渲染额外的 .ant-app 包装 div，保持原有 DOM 结构不变
// （根节点那套 height:100vh 的 flex 布局对中间多一层 div 是敏感的）。
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntApp component={false}>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
)
