// 构建期（Node）配置：Vite 开发代理的目标 SAP 主机。
// 与 src/config.js（运行时/浏览器配置）分开——本文件在 node 端被 vite.config.js 读取，
// 不能用 import.meta.env。改开发代理指向的 SAP 服务器，只改这里。
//
// 前端请求走代理前缀（/sap-dev、/sap-test），由 Vite 转发到下面的 target，绕开浏览器 CORS。
// 前缀本身在 src/config.js 的 ENVIRONMENTS 里拼路径时使用，二者的 key 要对应。
export const PROXY_TARGETS = {
  '/sap-dev': 'http://172.18.1.10:8400',
  '/sap-test': 'http://172.18.1.10:8010',
}
