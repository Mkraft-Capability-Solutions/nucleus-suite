/** "theming" catalog, zh. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "更改外观",
    title: "外观",
    themeLegend: "主题",
    modeLegend: "模式",
  },
  modes: {
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
  },
  themes: {
    horizon: "地平线",
    signature: "招牌",
    sapphireTide: "蓝宝石潮",
    emeraldGrove: "翡翠林",
    saffronEmber: "藏红余烬",
    roseQuartz: "玫瑰石英",
    platinum: "铂金",
  },
  logo: {
    alt: "{name} 标志",
  },
  branding: {
    errors: {
      themeId: "请选择一个可用主题。",
      defaultMode: "请选择浅色、深色或跟随系统模式。",
      displayName: "请输入 1 至 {max} 个字符的显示名称。",
      logoType: "请上传 SVG 或 PNG 文件。",
      logoSize: "标志文件不得超过 {max} KB。",
      logoHeight: "标志高度至少为 {min} 像素。",
      logoAspect: "标志宽高比必须介于 1:1 与 {max}:1 之间。",
      logoUnsafe: "此 SVG 包含脚本或外部引用，无法使用。",
    },
  },
};

export default messages;
