// 「中文标签 + 技术字段名」的显示格式，及其逆运算。
//
// 表单里的 label 要同时给出中文和 ABAP 技术名（物料号 (MATNR)），这个拼法由
// metadataToSchema 在生成 schema 时烘焙进 title；而 visibility.js 的显隐树自己
// 也要拼「技术名（中文）」，读的是同一个 title —— 不先把技术名摘掉就会拼成
// 「MATNR（物料号 (MATNR)）」。两边共用本模块，格式只在这里定义一次。
//
// 技术名不需要单独存：schema 里 property 的 key 就是技术名（metadataToSchema 用
// node.name 作 key），所以 strip 时总能拿到 key 来做比对。

/**
 * 拼成 `中文 (TECH)`。没有中文标签、或标签本身就是技术名时，只留技术名。
 * @param {string} label 中文标签（可空）
 * @param {string} name  技术字段名
 */
export function withTechName(label, name) {
  if (!label || label === name) return name || ''
  return `${label} (${name})`
}

/**
 * withTechName 的逆运算：把 `中文 (TECH)` 还原成 `中文`。
 * 只在后缀恰好是 ` (${name})` 时才剥，故对没烘焙过技术名的旧 schema（title 就是
 * 纯中文）原样返回 —— 历史记录和变式里存的是旧格式，必须继续读得懂。
 * @param {string} title schema 里的 title
 * @param {string} name  该字段的技术名（= property key）
 */
export function stripTechName(title, name) {
  if (!title || !name) return title
  const suffix = ` (${name})`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title
}
