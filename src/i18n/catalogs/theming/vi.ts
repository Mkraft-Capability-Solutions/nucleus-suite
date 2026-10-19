/** "theming" catalog, vi. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Thay đổi giao diện",
    title: "Giao diện",
    themeLegend: "Chủ đề",
    modeLegend: "Chế độ",
  },
  modes: {
    light: "Sáng",
    dark: "Tối",
    system: "Hệ thống",
  },
  themes: {
    horizon: "Chân trời",
    signature: "Đặc trưng",
    sapphireTide: "Thủy triều Sapphire",
    emeraldGrove: "Rừng Ngọc lục bảo",
    saffronEmber: "Than hồng Nghệ tây",
    roseQuartz: "Thạch anh hồng",
    platinum: "Bạch kim",
  },
  logo: {
    alt: "Logo của {name}",
  },
  branding: {
    errors: {
      themeId: "Hãy chọn một trong các chủ đề có sẵn.",
      defaultMode: "Hãy chọn chế độ sáng, tối hoặc theo hệ thống.",
      displayName: "Nhập tên hiển thị dài từ 1 đến {max} ký tự.",
      logoType: "Tải lên tệp SVG hoặc PNG.",
      logoSize: "Logo không được vượt quá {max} KB.",
      logoHeight: "Logo phải cao ít nhất {min} pixel.",
      logoAspect: "Tỷ lệ logo (rộng : cao) phải nằm trong khoảng 1:1 đến {max}:1.",
      logoUnsafe: "Tệp SVG này chứa tập lệnh hoặc tham chiếu bên ngoài nên không thể sử dụng.",
    },
  },
};

export default messages;
