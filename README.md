# Formily JSON Schema → 表单 Demo

左边粘贴 JSON Schema，点「生成表单」，右边实时渲染成可填写的 Ant Design 表单；
点「提交」后经过校验，弹出最终出参 JSON（即将来要回传给 SAP FM 的入参）。

## 运行

```bash
cd formily-demo
npm install
npm run dev
```

浏览器自动打开 http://localhost:5173

## 配置 / 换一套 SAP 系统

跟 SAP 相关的可变配置（代理目标主机、ICF 服务名、client、action 名）全部集中在根目录 **`.env`**。

```bash
cp .env .env.local   # 只留要改的行，其余自动沿用 .env 默认值
npm run dev          # env 只在启动时读一次，改完必须重启
```

- `.env` —— 项目默认值，**进 git**，clone 下来就能跑。
- `.env.local` —— 本机覆盖，**已被 .gitignore 忽略**，不会上传、不影响别人。Vite 先读 `.env` 再读 `.env.local`，同名 key 以后者为准。
- 变量分两类：`SAP_*_TARGET` 是 node 端读的代理目标主机（`vite.config.js` 扫描它们自动生成代理，`SAP_DEV_TARGET` → `/sap-dev`）；`VITE_*` 才会被打进前端包、浏览器里能读到。
- 其中「服务名」= SAP 事务码 SICF 里那个 HTTP 服务节点名，也就是直连地址 `http://<主机>:<端口>/<服务名>` 的最后一段。

## 连接设置（环境 / 账号）

本地开发时点顶栏的环境 chip 打开：环境下拉 + SAP 用户名 + 密码 + **「应用并连接」**。

弹层里改的是草稿，**点按钮才生效**——不是边填边生效。点下去会先用刚填的凭据发一次只读请求探连通性与鉴权，通了才提交并重拉记录/变式/分享三份列表；连不上就报错并把弹层留在原地。这样密码敲一半不会被中途的请求用掉，也不会出现「填了账号列表却还是空的」（页面挂载时那次拉取用的是空账号）。

生效后，`env` 决定请求地址（开发走 `vite.config.js` 的 `/sap-dev` 代理，生产是同源相对路径），用户名非空才会带 `Authorization: Basic`。这些值在**每次发请求的那一刻**才被读取，所以切环境不会重拉元数据、不会清空已生成的表单；调用记录里存的环境是**提交那一刻**的环境。反过来，填充一条历史记录会把环境切回记录当时的环境。

生产构建（部署到 BSP）下前端与 SAP 同源、走浏览器已有的会话，chip 退化成纯展示标签，账号密码不存在。密码只在内存，刷新页面即失效。

> **本地开发的请求一律 `credentials: 'omit'`（不带 cookie）。** 走 vite 代理时 SAP 的 `Set-Cookie` 会透传下来落在 localhost 上，只要成功登录过一次，之后每个请求都自动带 `SAP_SESSIONID`，而 SAP 认 cookie 优先于 `Authorization` —— 那样密码填错也照样通，换个用户名还是旧身份在跑。omit 顺带挡掉浏览器在 401 时自弹的原生登录框（登一次又种回 cookie），我们手写的 `Authorization` 头不受影响。生产构建反过来保持 `same-origin`，那里靠的就是会话。

## 目录结构

```
.env                       SAP 相关配置（代理主机 / ICF 服务名 / client / action 名），换系统只改这里
vite.config.js             构建期：按 .env 的 SAP_*_TARGET 自动生成开发代理
src/
  config.js                运行时：读 .env 拼环境地址与服务名 + 栅格列数
  theme.js                 全局视觉：ConfigProvider 主题 token（主色/圆角/字号/卡片头底色）
  App.jsx                  布局骨架（顶栏 + 函数栏 + 主区 Tabs）+ 组装 hooks/Modal
  metadataToSchema.js      中性元数据 → Formily Schema（叶子进 FormGrid 栅格）
  visibility.js            字段显隐纯逻辑（对 FormGrid void 节点透传，路径不变）
  form/
    schemaField.js         createSchemaField 组件注册表
    BoolCheckbox.jsx       SAP 布尔标志位（X/空）勾选框
    layout.jsx             Block（可折叠卡片）+ WidthItem（兼容旧记录）
  api/sapClient.js         获取元数据 / 提交调用 / 记录存储（Z_INVOKER_STORE）的网络层
  hooks/
    useDynamicForm.js      schema/显隐/form 重建 + 派生数据
    useRecordStore.js      SAP 后端存储底座（ZINVOKER_REC 表），下面两个 hook 共用
    useCallHistory.js      调用记录（kind='HIST'）
    useVariants.js         变式：命名的表单状态（kind='VAR'，含显隐配置）
  components/
    ConnectionPopover.jsx  顶栏环境 chip，点开是环境/用户名/密码（仅本地开发可编辑）
    SchemaPane.jsx         主区 Tab：中性元数据 ⇄ Formily Schema 两种格式，编辑后应用到表单
    PayloadPane.jsx        主区 Tab：实时请求 Body 预览，也可反向手改 JSON 回填表单
    AssetHubModal.jsx      数据资产中心：调用记录 / 变式 / 分享给我的 三合一弹窗
    RecordList.jsx         上面三个 Tab 共用的行渲染（就地改名 + 主动作 + ⋯ 菜单）
    JsonEditor.jsx         等宽字体 JSON 文本域（各处共用）
    VisibilityModal.jsx    字段显隐配置（勾选树 / 可分享 JSON）
    ResultModal.jsx        提交返回结果
```

## 布局

页面自上而下三段：

```
顶栏    图标 + 标题 + 环境 chip │ 数据资产中心 · 全部折叠 · 字段显隐 · 提交并调用 SAP
函数栏  SAP 函数名称 [Z_GET_SD_BILLING]  [从 SAP 后端拉取 ▾]
主区    [动态表单视图] [JSON Schema 结构] [请求 Body 预览&填充]      表头字段 N 个 · 表结构 M 个
```

- **函数名常驻输入框**：拉元数据的按钮是 `Dropdown.Button`，下拉可切「从 SAP 后端拉取 / AI 智能解析」两种方式，主键执行当前选中项——两者并列可选，不做自动降级。
- **三个 Tab 面板始终挂载**（`destroyInactiveTabPane` 保持默认 false）。这是硬约束：切走若卸载 `SchemaField`，Formily 字段模型会走 `onUnmount` 从 form graph 移除，已填的值和 ArrayTable 的行会全丢。改这块时务必实测「填几个字段 + 加两行表格 → 切到 Schema Tab → 切回来」。
- **请求 Body 是实时的**：`PayloadPane` 订阅 form 变更；手改 JSON 后进入「已手动编辑」态，不再被表单变更冲掉，点「同步 Body 至表单」或「重置为当前表单」回到实时。
- 叶子字段由 `metadataToSchema` 分组进官方 **FormGrid** 响应式栅格：宽屏多列、窄屏自动减列，长字段 `gridSpan` 占多列（不再手写像素宽）。
- 结构（STRUCTURE）渲染成**可折叠卡片**（`Block`），点标题右侧箭头收起/展开。
- FormGrid 是无数据的 void 容器，`visibility.js` 对它透传，故字段路径仍是「结构名.字段名」——历史记录和显隐方案跨改版仍可套用。

## 数据资产中心

调用记录、变式、分享给我的本质是同一张后端表（`ZINVOKER_REC`）的不同视图，合并成一个弹窗的三个 Tab。底部的「下载全部 / 导入分享文件 / 清空」跟随当前 Tab 生效；分享 Tab 下整组隐藏——收件箱里的记录不是自己的，没有「清空」语义，想长期留着要用行内的「另存为我的」复制一份。

## 看点


- `IV_EBELN`：ELEM → Input，`required: true` 演示必填校验，`maxLength` 演示长度限制
- `IV_BSART`：domain 固定值 → `enum` → Select 下拉
- `IV_BEDAT`：DATS → DatePicker，`format: YYYYMMDD` 存字符串
- `IS_HEADER`：STRUCTURE → 嵌套对象
- `IT_ITEMS`：TABLE → ArrayTable，可增删行

## 关键概念（对应你后端 metadata 的映射）

| Schema 字段 | 作用 | 后端从哪来 |
|---|---|---|
| `type` / `x-component` | 决定用哪个控件 | 由 ui_type 映射 |
| `title` | label | desc |
| `required` | 必填校验 | 参数 optional 反推 |
| `enum` | 下拉选项 | domain fixed values |
| `x-component-props.maxLength` | 长度 | length |
| `x-validator` | 更复杂校验 | conv_exit / 正则 |

> 只要注册进 `createSchemaField({ components })` 的组件，才能在 `x-component` 里引用。
> 想挂 SAP F4 搜索帮助，就自定义一个组件（如 `MatnrSearch`）注册进去，再在 schema 里 `"x-component": "MatnrSearch"`。
