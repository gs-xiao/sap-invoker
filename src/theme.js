// 全局视觉主题：只走 antd v5 的 ConfigProvider token，不覆盖 antd 内部 class。
//
// 这样做的好处是升级 antd 不会因为改了类名而破相；代价是只能调到「八成像」设计稿，
// 少数细节（比如卡片标题左侧那道竖条）由组件自己用行内样式补，见 form/layout.jsx。
//
// 改配色只动这里；组件里请勿再散落硬编码色值。

export const BRAND = '#2563eb'      // 主色（按钮、选中态、链接）
export const SURFACE = '#f8fafc'    // 页面/卡片头部底色
export const HAIRLINE = '#e2e8f0'   // 分隔线

export const theme = {
  token: {
    colorPrimary: BRAND,
    colorLink: BRAND,
    colorBorderSecondary: HAIRLINE,
    // 整体偏紧凑：字号与控件高度都比 antd 默认(14/32)小一档
    fontSize: 13,
    controlHeight: 30,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
  },
  components: {
    Card: { headerBg: SURFACE },
    Modal: { borderRadiusLG: 16 },
    // 弹窗内的列表行不要太挤，给回一点内边距
    List: { itemPaddingSM: '10px 12px' },
  },
}
