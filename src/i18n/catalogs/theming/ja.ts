/** "theming" catalog, ja. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "外観を変更",
    title: "外観",
    themeLegend: "テーマ",
    modeLegend: "モード",
  },
  modes: {
    light: "ライト",
    dark: "ダーク",
    system: "システム",
  },
  themes: {
    horizon: "ホライズン",
    signature: "シグネチャー",
    sapphireTide: "サファイアタイド",
    emeraldGrove: "エメラルドグローブ",
    saffronEmber: "サフランエンバー",
    roseQuartz: "ローズクォーツ",
    platinum: "プラチナ",
  },
  logo: {
    alt: "{name} のロゴ",
  },
  branding: {
    errors: {
      themeId: "利用可能なテーマから 1 つ選択してください。",
      defaultMode: "ライト、ダーク、またはシステムモードを選択してください。",
      displayName: "1～{max} 文字の表示名を入力してください。",
      logoType: "SVG または PNG ファイルをアップロードしてください。",
      logoSize: "ロゴは {max} KB 以下にしてください。",
      logoHeight: "ロゴの高さは {min} ピクセル以上にしてください。",
      logoAspect: "ロゴの縦横比（幅：高さ）は 1:1 から {max}:1 の範囲にしてください。",
      logoUnsafe: "この SVG にはスクリプトまたは外部参照が含まれているため使用できません。",
    },
  },
};

export default messages;
