/** "theming" catalog, ko. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "화면 모양 변경",
    title: "화면 모양",
    themeLegend: "테마",
    modeLegend: "모드",
  },
  modes: {
    light: "라이트",
    dark: "다크",
    system: "시스템",
  },
  themes: {
    horizon: "호라이즌",
    signature: "시그니처",
    sapphireTide: "사파이어 타이드",
    emeraldGrove: "에메랄드 그로브",
    saffronEmber: "사프란 엠버",
    roseQuartz: "로즈 쿼츠",
    platinum: "플래티넘",
  },
  logo: {
    alt: "{name} 로고",
  },
  branding: {
    errors: {
      themeId: "사용 가능한 테마 중 하나를 선택하세요.",
      defaultMode: "라이트, 다크 또는 시스템 모드를 선택하세요.",
      displayName: "1~{max}자의 표시 이름을 입력하세요.",
      logoType: "SVG 또는 PNG 파일을 업로드하세요.",
      logoSize: "로고는 {max}KB 이하여야 합니다.",
      logoHeight: "로고 높이는 {min}픽셀 이상이어야 합니다.",
      logoAspect: "로고 비율(너비:높이)은 1:1에서 {max}:1 사이여야 합니다.",
      logoUnsafe: "이 SVG에는 스크립트나 외부 참조가 포함되어 있어 사용할 수 없습니다.",
    },
  },
};

export default messages;
