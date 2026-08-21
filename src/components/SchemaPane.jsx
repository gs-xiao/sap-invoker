// 「JSON Schema 结构」页：一块编辑区，用 Segmented 切两种输入格式。
//
// 两种格式对应两条**语义不同**的路径，别混为一谈：
//  · 中性元数据   → metadataToSchema 转换 → applySchema      → 当成一个新表单，显隐配置重置、值清空
//  · Formily Schema → 直接应用          → applySchemaKeepState → 只换结构，已填值和显隐配置保留
// 所以按钮文案也是两个（「转换并生成」/「应用到表单」），不做成一个通用的「应用」。
import React from 'react'
import { Segmented, Button, Alert, Space } from 'antd'
import JsonEditor from './JsonEditor'

const HINT = {
  meta: '中性元数据 JSON（后端 /元数据接口的原始返回格式）。转换会生成一个全新表单：已填的值和字段显隐配置都会重置。',
  schema: '当前表单的 Formily JSON Schema，可直接改结构 / 布局。应用时会保留已填的值与字段显隐配置。',
}

export default function SchemaPane({
  mode, setMode,
  metaText, setMetaText, onConvertMeta,
  schemaText, setSchemaText, onApplySchema,
  error,
}) {
  const isMeta = mode === 'meta'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <Space wrap>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'meta', label: '中性元数据' },
            { value: 'schema', label: 'Formily Schema' },
          ]}
        />
        <span style={{ color: '#888', fontSize: 12 }}>{HINT[mode]}</span>
      </Space>

      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {isMeta ? (
          <JsonEditor
            value={metaText}
            onChange={setMetaText}
            placeholder={'粘贴中性元数据 JSON，再点「转换并生成」。\n例：\n{\n  "function": "ZTEST_STR",\n  "params": [\n    { "name": "IV_MATNR", "kind": "ELEM", "label": "物料号", "ddic_type": "CHAR", "length": 18, "required": true }\n  ]\n}'}
          />
        ) : (
          <JsonEditor
            value={schemaText}
            onChange={setSchemaText}
            placeholder="粘贴或修改 Formily JSON Schema，再点「应用到表单」。上方函数栏拉取元数据后，这里会自动填成当前表单的 Schema。"
          />
        )}
      </div>

      {error && <Alert type="error" message={error} />}

      <Space>
        {isMeta ? (
          <Button type="primary" disabled={!metaText.trim()} onClick={onConvertMeta}>转换并生成表单 ▶</Button>
        ) : (
          <Button type="primary" disabled={!schemaText.trim()} onClick={onApplySchema}>应用到表单（保留已填值）▶</Button>
        )}
      </Space>
    </div>
  )
}
