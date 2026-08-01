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

## 目录结构

```
.env                       SAP 相关配置（代理主机 / ICF 服务名 / client / action 名），换系统只改这里
vite.config.js             构建期：按 .env 的 SAP_*_TARGET 自动生成开发代理
src/
  config.js                运行时：读 .env 拼环境地址与服务名 + 显隐方案上限、栅格列数
  App.jsx                  布局骨架 + 组装 hooks/Modal
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
    useVariants.js         变式：命名的表单状态（kind='VAR'）
    useVisibilityProfiles.js  显隐方案持久化（仍走 localStorage）
  components/*Modal.jsx    各弹窗（元数据/填充/记录/变式/收件箱/结果/显隐/方案）
```

## 布局

- 叶子字段由 `metadataToSchema` 分组进官方 **FormGrid** 响应式栅格：宽屏多列、窄屏自动减列，长字段 `gridSpan` 占多列（不再手写像素宽）。
- 结构（STRUCTURE）渲染成**可折叠卡片**（`Block`），点标题右侧箭头收起/展开。
- FormGrid 是无数据的 void 容器，`visibility.js` 对它透传，故字段路径仍是「结构名.字段名」——历史记录和显隐方案跨改版仍可套用。

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
