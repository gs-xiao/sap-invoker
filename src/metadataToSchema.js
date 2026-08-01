// 中性参数元数据 → Formily JSON Schema 的映射层。
//
// 设计要点：ABAP 只吐「中性元数据」（参数名 / kind / ddic 类型 / 长度 / 必填 /
// domain 固定值 / 标签），前端在这里把它翻译成 Formily 的 x-component 写法。
// Formily/antd 的 UI 约定要变，只改本文件，ABAP 不用动。
//
// 元数据节点结构（每个参数 / 字段 / 列 都是一个 node）：
//   {
//     name: 'IV_EBELN',                  // 字段 key（唯一）
//     kind: 'ELEM' | 'STRUCTURE' | 'TABLE',
//     label: '采购订单号',                // title；缺省用 name
//     ddic_type: 'CHAR' | 'DATS' | 'CURR' | ...,   // ELEM 才有
//     length: 10, decimals: 2,           // ELEM 才有
//     required: true,
//     fixed_values: [{ value, text }],   // domain 固定值 → 下拉
//     format: 'email',                   // 可选，映射为 x-validator
//     boolean: true,                     // 可选，标志位 → Checkbox
//     component: 'MatnrSearch',          // 可选，显式覆盖控件（如挂 F4 搜索帮助）
//     'component-props': {},             // 可选，配合 component 的 props
//     width: 160,                        // 可选，仅 TABLE 列宽
//     children | columns | fields | params: [ ...子节点 ]   // STRUCTURE/TABLE 才有
//   }
//
// 无限嵌套：buildField 对 STRUCTURE/TABLE 递归调用自身，所以结构套表、表套结构、
// 表套表……任意层级都支持。

import { GRID } from './config'

// ddic 数值类型
const NUMERIC_TYPES = new Set(['INT1', 'INT2', 'INT4', 'INT8', 'DEC', 'CURR', 'QUAN', 'FLTP', 'PREC'])
// ddic 日期类型
const DATE_TYPES = new Set(['DATS'])

// 取一个节点的子节点（兼容 children/columns/fields/params 几种命名）
function childrenOf(node) {
  return node.children || node.columns || node.fields || node.params || []
}

// 判断是否为 SAP 布尔标志位：显式 boolean:true，或 fixed_values 为 1~2 项且值都落在
// {X, 空}（CHAR1 XFELD 惯例，很多 domain 只定义了 X=是 一项）。这类用勾选框，不做成
// 下拉；两值以上、或值非 X/空的固定值（税码、A/B 业务码等）仍是普通下拉，不误伤。
function isBoolFlag(node) {
  if (node.boolean) return true
  const fv = node.fixed_values
  if (fv && fv.length >= 1 && fv.length <= 2) {
    const vals = fv.map((v) => String(v.value ?? '').trim().toUpperCase())
    return vals.includes('X') && vals.every((v) => v === 'X' || v === '')
  }
  return false
}

// 判断 ELEM 该用什么控件
function elemComponent(node) {
  // 1) 显式覆盖优先（自定义控件 / F4 搜索帮助）
  if (node.component) {
    return { component: node.component, props: node['component-props'] || {} }
  }
  // 2) 布尔标志位（X/空）→ 勾选框，优先于普通下拉
  if (isBoolFlag(node)) {
    return { component: 'BoolCheckbox', props: {} }
  }
  // 3) 其余有固定值 → 下拉（allowClear：选中后可点 ✕ 清空回未选中）
  if (node.fixed_values && node.fixed_values.length) {
    return { component: 'Select', props: { placeholder: '请选择', allowClear: true } }
  }
  const t = (node.ddic_type || '').toUpperCase()
  // 4) 日期（DatePicker 默认即可清除；显式写 allowClear 保持一致、防未来默认值变化）
  if (DATE_TYPES.has(t)) {
    return { component: 'DatePicker', props: { format: 'YYYYMMDD', allowClear: true, style: { width: '100%' } } }
  }
  // 5) 数值
  if (NUMERIC_TYPES.has(t)) {
    return { component: 'NumberPicker', props: { style: { width: '100%' } } }
  }
  // 6) 兜底文本
  return { component: 'Input', props: {} }
}

// 估算叶子字段在响应式栅格里占的列数（gridSpan）：长文本（Input 且 length 较大）占 2 列，
// 其余定长/短字段占 1 列。列宽本身由 FormGrid 按容器宽度等分，这里只决定「谁更宽」。
function estimateGridSpan(node, component) {
  if (component === 'Input' && node.length && node.length >= 40) return 2
  return 1
}

// ELEM → 字段 schema
function buildElem(node) {
  const t = (node.ddic_type || '').toUpperCase()
  const bool = isBoolFlag(node)
  const { component, props } = elemComponent(node)

  // 布尔标志位值是 'X'/''（字符串）；数值才是 number；其余字符串
  let dataType = 'string'
  if (!bool && NUMERIC_TYPES.has(t)) dataType = 'number'

  const schema = {
    type: dataType,
    title: node.label || node.name,
    'x-decorator': 'FormItem',
    'x-component': component,
  }

  // 长字段在栅格里占多列（等宽栅格 + 长字段占多列）
  const span = estimateGridSpan(node, component)
  if (span > 1) schema['x-decorator-props'] = { gridSpan: span }

  const cprops = { ...props }
  if (component === 'Input' && node.length) cprops.maxLength = node.length
  if (component === 'NumberPicker' && node.decimals != null) cprops.precision = node.decimals
  if (Object.keys(cprops).length) schema['x-component-props'] = cprops

  // 只有「非布尔」的固定值才做成下拉 enum；布尔标志位由 BoolCheckbox 承载，不设 enum。
  // 注意：SAP domain 的首个固定值常是「空/初始值」（无 value 字段）。若直接用 undefined 作选项值，
  // antd Select 会把它当成「未选中」，导致选了别的值后无法再切回该空选项、且回显为占位符。
  // 故把缺失的 value 归一成空字符串 ''，让空选项成为可区分、可切换、能正确回显 label 的真实值。
  if (!bool && node.fixed_values && node.fixed_values.length) {
    schema.enum = node.fixed_values.map((v) => ({
      label: v.text ?? v.value ?? '',
      value: v.value ?? '',
    }))
  }
  if (node.required) schema.required = true
  if (node.format) schema['x-validator'] = node.format

  return schema
}

// STRUCTURE → 块容器（可折叠 Card），子字段进响应式栅格
function buildStructure(node) {
  return {
    type: 'object',
    title: node.label || node.name,
    'x-component': 'Block',
    properties: layoutProperties(childrenOf(node)),
  }
}

// 估算表格列宽（px）：字段长度 × 10，夹在 50~300；没有长度的列（日期/下拉/
// 布尔/列里套结构或表）统一给 100。优先级：元数据显式 width > 估算值。
function estimateColumnWidth(node) {
  if (node.width) return node.width // 元数据显式给了 width，直接用

  const MIN = 50
  const MAX = 300
  if (!node.length) return 100 // 无 length，给默认宽
  return Math.max(MIN, Math.min(MAX, node.length * 10))
}

// 判断一个 TABLE 的列里是否还套着「表 / 结构」（即是否为嵌套层）。
// 叶子表（列全是 ELEM）用 ArrayTable 观感好；含嵌套则改用 ArrayCollapse 向下展开，
// 避免深层嵌套时表格横向撑爆。
function hasNestedContainer(node) {
  return childrenOf(node).some((c) => {
    const k = (c.kind || 'ELEM').toUpperCase()
    return k === 'TABLE' || k === 'STRUCTURE'
  })
}

// 把叶子字段复位为「不吃栅格」的普通 FormItem：表格单元格、折叠面板里的字段列宽/宽度
// 由外层（ArrayTable.Column / 面板）控制，所以去掉 gridSpan（新）或固定宽 width（旧 schema）。
// 兼容旧 schema：旧叶子装饰器是 WidthItem，一并复位为 FormItem。
function toFormItemLeaf(field) {
  if (!field) return field
  if (field['x-decorator'] === 'WidthItem') field['x-decorator'] = 'FormItem'
  const dp = field['x-decorator-props']
  if (dp) {
    delete dp.gridSpan
    delete dp.width
    if (Object.keys(dp).length === 0) delete field['x-decorator-props']
  }
  return field
}

// 含嵌套的数组 → ArrayCollapse：每个数组元素是一个可折叠面板，点标题向下展开。
// 面板内递归 buildField：子表若仍含嵌套会再变 ArrayCollapse，叶子表回落 ArrayTable，
// 故任意层级都向下堆叠、永不横向滚动。
function buildCollapse(node) {
  const label = node.label || node.name
  // 面板内叶子字段走响应式栅格（layoutProperties：叶子进 FormGrid、嵌套表/结构仍整行独立），
  // 这样折叠面板里的标量字段也能多列自适应，而不是一行一个竖着堆。
  const childProps = layoutProperties(childrenOf(node))
  const panelProps = {
    // 面板内顶部显示序号（#1、#2…），因 header 是静态文案、各面板同名，靠它区分
    c_index: { type: 'void', 'x-component': 'ArrayCollapse.Index' },
    ...childProps, // 各字段（递归；叶子已分组进 FormGrid）
    // 尾部：删除本行面板
    c_remove: { type: 'void', 'x-component': 'ArrayCollapse.Remove' },
  }

  return {
    type: 'array',
    title: label,
    'x-decorator': 'Block',
    'x-component': 'ArrayCollapse',
    // 默认展开第 1 个面板，其余收起；行多时不会一屏全炸开
    'x-component-props': { defaultOpenPanelCount: 1 },
    items: {
      // 关键：必须是 object —— ArrayCollapse 靠它给每个数组元素建立独立对象作用域
      // （字段路径 array.index.field）。若写成 void，整行字段会塌缩到同一路径而联动。
      type: 'object',
      'x-component': 'ArrayCollapse.CollapsePanel',
      // header 为静态文案（各面板同名）；序号由面板内的 ArrayCollapse.Index 显示
      'x-component-props': { header: label },
      properties: panelProps,
    },
    properties: {
      add: {
        type: 'void',
        title: `新增${node.label ? '「' + node.label + '」' : '一行'}`,
        'x-component': 'ArrayCollapse.Addition',
      },
    },
  }
}

// TABLE → ArrayTable（每列包一层 void Column，列内递归 buildField，支持列里再套结构/表）
function buildTable(node) {
  // 含嵌套（列里套表/结构）→ 改走向下展开的 ArrayCollapse，避免横向撑爆
  if (hasNestedContainer(node)) return buildCollapse(node)

  const cols = childrenOf(node)
  const itemProps = {}

  cols.forEach((col, i) => {
    const key = col.name || `col${i}`
    // 列头由 ArrayTable.Column.title 显示；列内字段再带 title 会让每个单元格上方
    // 重复出现一遍字段名，故去掉里层字段自身的 title（FormItem 保留，仍显示校验）。
    const field = buildField(col)
    delete field.title
    toFormItemLeaf(field) // 单元格不套固定宽外壳，列宽由 ArrayTable.Column.width 控制
    itemProps[`c_${key}`] = {
      type: 'void',
      'x-component': 'ArrayTable.Column',
      'x-component-props': { title: col.label || col.name, width: estimateColumnWidth(col) },
      // 关键：列包装器是 void（不存数据），真实字段名放里层；里层递归，故可无限嵌套
      properties: { [key]: field },
    }
  })

  // 尾部固定「操作」列（删除行）
  itemProps.c_remove = {
    type: 'void',
    'x-component': 'ArrayTable.Column',
    'x-component-props': { title: '操作', width: 80, align: 'center', fixed: 'right' },
    properties: { remove: { type: 'void', 'x-component': 'ArrayTable.Remove' } },
  }

  return {
    type: 'array',
    title: node.label || node.name,
    'x-decorator': 'Block',
    'x-component': 'ArrayTable',
    // scroll.x = max-content：按列宽之和排版、超出则横向滚动，
    // 否则 antd 会把列拉伸填满容器，导致设的 width 被冲掉（加行后尤其明显）
    'x-component-props': { scroll: { x: 'max-content' } },
    items: { type: 'object', properties: itemProps },
    properties: {
      add: {
        type: 'void',
        title: `新增${node.label ? '「' + node.label + '」' : '一行'}`,
        'x-component': 'ArrayTable.Addition',
      },
    },
  }
}

// 按 kind 分派（递归入口）
function buildField(node) {
  switch ((node.kind || 'ELEM').toUpperCase()) {
    case 'STRUCTURE':
      return buildStructure(node)
    case 'TABLE':
      return buildTable(node)
    default:
      return buildElem(node)
  }
}

// 是否为叶子字段（进栅格）：STRUCTURE/TABLE 是容器（整行独立），其余按叶子处理
function isLeafKind(node) {
  const k = (node.kind || 'ELEM').toUpperCase()
  return k !== 'STRUCTURE' && k !== 'TABLE'
}

// 一组子节点 → properties，并做「栅格分组」：把连续的叶子字段收进一个 FormGrid void 节点
// （键名 _gridN），STRUCTURE/TABLE 容器作为整行独立兄弟直接输出、不进栅格。
// FormGrid 是无数据的 void 容器，不占字段路径 —— visibility.js 会透传它，故显隐配置路径不变。
// 供 buildStructure / buildCollapse / 顶层入口使用；表格单元格由 buildTable 自行组装（不分组）。
//
// 去重：同一层若出现重名字段（元数据里同名 node 重复出现），只保留第一个、跳过其余，
// 并告警。注意——这只能挡「完全同名」的重复；像 IS_HEADDATA / HEADDATA / headdata
// 这种「同一批字段的不同命名」是不同 key，无法在此自动判定谁是规范名，需在后端元数据源头修。
function layoutProperties(nodes) {
  const props = {}
  const seen = new Set()
  let gridIdx = 0
  let bucket = null // 当前累积中的一批叶子字段（FormGrid 的 properties）

  const flushBucket = () => {
    if (bucket && Object.keys(bucket).length) {
      props[`_grid${gridIdx++}`] = {
        type: 'void',
        'x-component': 'FormGrid',
        'x-component-props': {
          minColumns: GRID.minColumns,
          maxColumns: GRID.maxColumns,
          minWidth: GRID.minWidth,
          columnGap: GRID.columnGap,
          rowGap: GRID.rowGap,
        },
        properties: bucket,
      }
    }
    bucket = null
  }

  nodes.forEach((node, i) => {
    const key = node.name || `field${i}`
    if (seen.has(key)) {
      if (typeof console !== 'undefined') {
        console.warn(`[metadataToSchema] 跳过同层重名字段：${key}`)
      }
      return
    }
    seen.add(key)
    const field = buildField(node)
    if (isLeafKind(node)) {
      if (!bucket) bucket = {}
      bucket[key] = field // 叶子进当前栅格
    } else {
      flushBucket()       // 遇到容器先收尾当前栅格
      props[key] = field  // 容器整行独立输出
    }
  })
  flushBucket()
  return props
}

/**
 * 顶层入口：把 FM 元数据转成完整 Formily Schema。
 * @param {object} meta - { function, params: [ ...顶层参数 ] }（也接受 children/fields）
 * @returns {object} Formily JSON Schema
 */
export function metadataToSchema(meta) {
  const params = childrenOf(meta)
  return {
    type: 'object',
    properties: layoutProperties(params),
  }
}
