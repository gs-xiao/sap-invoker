// 运行时（浏览器）配置集中处。
//
// 跟 SAP 系统有关的值（ICF 服务名、client、action 名）全部来自根目录的 .env；
// 换一套系统只要复制 .env 为 .env.local 改值即可（.env.local 不进 git），不用动本文件。
// 栅格列数这类与 SAP 无关的参数仍直接写在下面。
//
// 注意：
//  · 只有 VITE_ 前缀的变量才会被打进前端包，浏览器里能读到；不带前缀的（如 SAP_DEV_TARGET）
//    只有 node 端的 vite.config.js 读得到。
//  · 改完 env 必须重启 npm run dev —— Vite 只在启动时读一次。

const ENV = import.meta.env ?? {}

// 读取必填 env：缺失或空值直接抛错并点名是哪个 key，避免拼出 /undefined?sap-client=undefined 这种地址
function need(key) {
  const v = ENV[key]
  if (v === undefined || v === '') {
    throw new Error(`缺少环境变量 ${key}：请在根目录 .env（或 .env.local）里配置后重启 dev server`)
  }
  return v
}

// 是否本地开发模式（npm run dev）。生产构建（部署到 BSP）为 false。
// 用于：本地才显示「环境选择 / 用户名 / 密码」，BSP 同源部署走 SAP 会话，隐藏这些。
// 注意这里必须直接写 import.meta.env.DEV（不能借道上面的 ENV 变量）——Vite 只对这种
// 写法做构建期静态替换，替换后下面的三元才能被摇掉死分支，开发用的地址不进生产包。
export const IS_DEV = import.meta.env?.DEV ?? false

// ---- 1) 三套环境的接口地址，按运行模式自适应 ----
// 服务名 = SAP 事务码 SICF 里的 HTTP 服务节点名，即直连地址 http://<主机>:<端口>/<服务名> 的最后一段。
//  · 本地开发（npm run dev）：走 vite.config.js 的开发代理（/sap-dev、/sap-test，代理由 .env 里的
//    SAP_*_TARGET 自动生成，变量名与前缀一一对应）转发到不同 SAP 服务器，绕开 CORS。
//  · 打包部署到 BSP（生产构建）：前端与 SAP 同源，代理不存在，直接相对调用，也无需 sap-client。
export const ENVIRONMENTS = IS_DEV
  ? {
      dev:  { label: '开发', url: `/sap-dev/${need('VITE_SAP_DEV_SERVICE')}?sap-client=${need('VITE_SAP_DEV_CLIENT')}` },
      test: { label: '测试', url: `/sap-test/${need('VITE_SAP_TEST_SERVICE')}?sap-client=${need('VITE_SAP_TEST_CLIENT')}` },
      prod: { label: '生产', url: '' }, // 本地开发下暂不可用，提交会拦截提示
    }
  : {
      dev:  { label: '开发', url: `/${need('VITE_SAP_PROD_SERVICE')}` },
      test: { label: '测试', url: `/${need('VITE_SAP_PROD_SERVICE')}` },
      prod: { label: '生产', url: `/${need('VITE_SAP_PROD_SERVICE')}` },
    }

// ---- 2) SAP 服务相关固定值（同样来自 .env）----
export const SAP = {
  metadataAction: need('VITE_SAP_META_ACTION'),      // 返回元数据的服务 action（不对用户开放修改）
  metadataAiAction: need('VITE_SAP_META_AI_ACTION'), // AI 方式返回元数据的服务 action（入参/出参同上）
  storeAction: need('VITE_SAP_STORE_ACTION'),        // 调用记录/变式/分享 存储入口（按 body.op 分派）
  metadataFuncKey: need('VITE_SAP_META_FUNC_KEY'),   // 获取元数据时请求体里「目标函数名」的字段名
  defaultFuncName: need('VITE_SAP_DEFAULT_FUNC'),    // 目标 FM 函数名的默认值
}

// ---- 3) 表单响应式栅格（FormGrid）默认参数 ----
// metadataToSchema 生成叶子字段栅格时读取；minWidth 优先于 minColumns 决定实际列数。
export const GRID = {
  minColumns: 1,
  maxColumns: 3,
  minWidth: 240,
  columnGap: 16,
  rowGap: 0,
}
