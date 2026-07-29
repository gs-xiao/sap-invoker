// 运行时（浏览器）配置集中处。想改环境地址、元数据服务名、localStorage 存储上限、
// 栅格列数等，只改这一个文件，不用翻组件源码。
//
// 注意：构建期的开发代理目标主机在项目根的 sap.config.js（node 端，不能用 import.meta.env）。

// 是否本地开发模式（npm run dev）。生产构建（部署到 BSP）为 false。
// 用于：本地才显示「环境选择 / 用户名 / 密码」，BSP 同源部署走 SAP 会话，隐藏这些。
export const IS_DEV = import.meta.env?.DEV ?? false

// ---- 1) 三套环境的接口地址，按运行模式自适应 ----
//  · 本地开发（npm run dev，import.meta.env.DEV=true）：走 vite.config.js 的开发代理
//    （/sap-dev、/sap-test，见根目录 sap.config.js）转发到不同 SAP 服务器，绕开 CORS。
//  · 打包部署到 BSP（生产构建）：前端与 SAP 同源，代理不存在，直接相对调用 zpub_api。
export const ENVIRONMENTS = import.meta.env?.DEV
  ? {
      dev:  { label: '开发', url: '/sap-dev/zpub_api?sap-client=300' },
      test: { label: '测试', url: '/sap-test/zpub_api?sap-client=700' },
      prod: { label: '生产', url: '' }, // 本地开发下暂不可用，提交会拦截提示
    }
  : {
      dev:  { label: '开发', url: '/zpub_api' },
      test: { label: '测试', url: '/zpub_api' },
      prod: { label: '生产', url: '/zpub_api' },
    }

// ---- 2) SAP 服务相关固定值 ----
export const SAP = {
  metadataAction: 'Z_INVOKER_META', // 返回元数据的服务 action（不对用户开放修改）
  metadataAiAction: 'Z_INVOKER_META_AI', // AI 方式返回元数据的服务 action（入参/出参同上）
  storeAction: 'Z_INVOKER_STORE',   // 调用记录/变式/分享 存储入口（按 body.op 分派）
  metadataFuncKey: 'func_name',                // 获取元数据时请求体里「目标函数名」的字段名
  defaultFuncName: 'Z_SRM_CREATE_PO',          // 目标 FM 函数名的默认值
}

// ---- 3) localStorage 持久化的键名与上限 ----
export const STORAGE = {
  historyKey: 'formily-demo:call-history',
  historyLimit: 200,
  schemaPoolKey: 'formily-demo:schema-pool',
  visProfileKey: 'formily-demo:visibility-profiles',
  visProfileLimit: 100,
  // 变式（手动保存的命名表单状态：值 + Schema + 显隐配置）
  variantKey: 'formily-demo:variants',
  variantLimit: 200,
  variantPoolKey: 'formily-demo:variant-schema-pool',
}

// ---- 4) 表单响应式栅格（FormGrid）默认参数 ----
// metadataToSchema 生成叶子字段栅格时读取；minWidth 优先于 minColumns 决定实际列数。
export const GRID = {
  minColumns: 1,
  maxColumns: 3,
  minWidth: 240,
  columnGap: 16,
  rowGap: 0,
}
