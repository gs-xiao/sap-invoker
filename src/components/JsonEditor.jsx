// 项目里到处要一块「等宽字体的 JSON 文本域」，样式统一收在这里，避免三四个地方各写一份行内样式。
import React from 'react'

export default function JsonEditor({ value, onChange, height = '100%', placeholder, readOnly }) {
  return (
    <textarea
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      readOnly={readOnly}
      spellCheck={false}
      placeholder={placeholder}
      style={{
        width: '100%',
        height,
        fontFamily: 'Consolas, Menlo, monospace',
        fontSize: 12,
        lineHeight: 1.6,
        resize: 'none',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 12,
        boxSizing: 'border-box',
        background: readOnly ? '#f8fafc' : '#fff',
        outline: 'none',
      }}
    />
  )
}
