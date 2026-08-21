// 动态表单面板。单独拆出来并套 React.memo，是为了把它和 App 的重渲染切断。
//
// 原先这棵 Formily 树是 App 的直接子节点，而 metaFuncName / metaText / shareUname 这些
// 输入态都挂在 App 上 —— 在顶栏函数名框或 Schema 编辑框里敲一个字符，整棵 RecursionField
// 就跟着重渲一次。字段几百个的表单（含 ArrayTable）手感会明显发滞。
//
// memo 生效的前提是四个 prop 都引用稳定：form / renderSchema 由 useDynamicForm 记忆化，
// collapseCmd 是 state 对象，onRollback 在 App 里用 useCallback 包过。改这里时留意别引入
// 行内新建的对象或箭头函数。
import React from 'react'
import { FormProvider } from '@formily/react'
import { FormLayout } from '@formily/antd-v5'
import { Alert } from 'antd'

import { SchemaField } from '../form/schemaField'
import { BlockCollapseContext } from '../form/layout'
import SchemaErrorBoundary from './SchemaErrorBoundary'

function FormPane({ form, renderSchema, collapseCmd, hasForm, canRollback, onRollback }) {
  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
      {!hasForm && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="尚未生成表单"
          description="在上方函数栏填 FM 名称后点「从 SAP 后端拉取」；也可以切到「JSON Schema 结构」页手动粘贴元数据或 Schema。"
        />
      )}
      <SchemaErrorBoundary resetKey={renderSchema} canRollback={canRollback} onRollback={onRollback}>
        <BlockCollapseContext.Provider value={collapseCmd}>
          <FormProvider form={form}>
            <FormLayout layout="vertical">
              <SchemaField schema={renderSchema} />
            </FormLayout>
          </FormProvider>
        </BlockCollapseContext.Provider>
      </SchemaErrorBoundary>
    </div>
  )
}

export default React.memo(FormPane)
