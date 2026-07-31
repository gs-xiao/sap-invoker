import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// 环境变量名 → 代理前缀：SAP_DEV_TARGET → /sap-dev、SAP_TEST_TARGET → /sap-test
// （下划线转横杠、转小写、去掉 _TARGET 后缀，与 src/config.js 里拼地址用的前缀保持一致）
const PREFIX_FROM_ENV = /^SAP_([A-Z0-9_]+)_TARGET$/
const prefixOf = (key) => '/sap-' + key.match(PREFIX_FROM_ENV)[1].toLowerCase().replace(/_/g, '-')

export default defineConfig(({ mode, command }) => {
  // 读本地 .env / .env.local（第 3 参 '' = 不限前缀，能读到无 VITE_ 前缀的变量）。
  // .env 是进 git 的默认值；.env.local 已被 .gitignore 忽略，其它设备在里面覆盖成自己的
  // 转发地址即可，不用改被 git 跟踪的文件。同名 key 以 .env.local 为准。
  const env = loadEnv(mode, process.cwd(), '')

  // 开发代理：绕开浏览器 CORS。前端请求 /sap-dev、/sap-test，由 Vite 转发到目标 SAP 主机
  // （node 端请求，不受同源策略限制），转发时把前缀从路径里剥掉（/sap-dev/xxx → /xxx）。
  //
  // 代理清单直接由 .env 里的 SAP_*_TARGET 反推，不再单独维护一份前缀表：
  // 新增一套环境 = .env 加一行 SAP_XXX_TARGET + src/config.js 的 ENVIRONMENTS 加一条即可。
  const proxy = Object.fromEntries(
    Object.keys(env)
      .filter((key) => PREFIX_FROM_ENV.test(key) && env[key])
      .map((key) => {
        const prefix = prefixOf(key)
        return [
          prefix,
          {
            target: env[key],
            changeOrigin: true,
            rewrite: (p) => p.replace(new RegExp(`^${prefix}`), ''),
          },
        ]
      })
  )

  // 生产构建不经过代理，没配也无所谓；dev 一个都没配则直接报错，免得请求莫名 404 难排查。
  if (command === 'serve' && Object.keys(proxy).length === 0) {
    throw new Error('未找到任何 SAP_*_TARGET：请在根目录 .env（或 .env.local）里配置开发代理的目标 SAP 主机')
  }

  return {
    plugins: [react()],
    // 关键：部署到 BSP 必须使用相对路径
    base: './',
    server: {
      host: true,        // 监听 0.0.0.0，局域网内其它机器可通过本机 IP 访问
      port: 5173,
      open: true,
      proxy,
    },
  }
})

