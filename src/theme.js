// 全局视觉主题：只走 antd v5 的 ConfigProvider token，不覆盖 antd 内部 class。
//
// 这样做的好处是升级 antd 不会因为改了类名而破相；代价是只能调到「八成像」设计稿，
// 少数细节（比如卡片标题左侧那道竖条）由组件自己用行内样式补，见 form/layout.jsx。
//
// 改配色只动这里；组件里请勿再散落硬编码色值。

export const BRAND = '#2563eb'      // 主色（按钮、选中态、链接）
export const SURFACE = '#f8fafc'    // 页面底色 / 卡片头部 / 输入框填充
export const HAIRLINE = '#e2e8f0'   // 分隔线
export const MUTED = '#94a3b8'      // 次要文字（副标题、计数、占位说明）

// 内容区限宽：超宽屏上表单铺满整行反而难读，跟设计稿一样居中收窄
export const CONTENT_MAX = 1180

export const theme = {
  token: {
    colorPrimary: BRAND,
    colorLink: BRAND,
    colorBorderSecondary: HAIRLINE,
    // 整体偏紧凑：字号与控件高度都比 antd 默认(14/32)小一档
    fontSize: 13,
    controlHeight: 30,
    borderRadius: 8,
    borderRadiusLG: 16,
    borderRadiusSM: 6,
  },
  components: {
    Card: { headerBg: SURFACE },
    Modal: { borderRadiusLG: 16 },
    // 弹窗内的列表行不要太挤，给回一点内边距
    List: { itemPaddingSM: '10px 12px' },

    // 录入控件统一浅灰填充（设计稿的 slate-50），聚焦时转白。
    // 三个组件各有各的背景 token，必须一起给，否则 Input 灰、Select 白会很扎眼：
    //   Input 走 colorBgContainer + hoverBg/activeBg，Select 走 selectorBg，
    //   DatePicker 没有专用 token，跟着组件级 colorBgContainer 走。
    Input: { colorBgContainer: SURFACE, hoverBg: SURFACE, activeBg: '#fff' },
    InputNumber: { colorBgContainer: SURFACE, hoverBg: SURFACE, activeBg: '#fff' },
    Select: { selectorBg: SURFACE },
    DatePicker: { colorBgContainer: SURFACE },

    // 主区页签用 Segmented 做成胶囊：选中=主色底白字。
    // （antd Tabs 的 type="card" 选中背景写死在样式里、不可配，做不出这个效果）
    Segmented: { itemSelectedBg: BRAND, itemSelectedColor: '#fff', trackBg: '#eef2f7' },
  },
}
