/** "theming" catalog, tr. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Görünümü değiştir",
    title: "Görünüm",
    themeLegend: "Tema",
    modeLegend: "Mod",
  },
  modes: {
    light: "Açık",
    dark: "Koyu",
    system: "Sistem",
  },
  themes: {
    horizon: "Ufuk",
    signature: "İmza",
    sapphireTide: "Safir Gelgit",
    emeraldGrove: "Zümrüt Koru",
    saffronEmber: "Safran Köz",
    roseQuartz: "Pembe Kuvars",
    platinum: "Platin",
  },
  logo: {
    alt: "{name} logosu",
  },
  branding: {
    errors: {
      themeId: "Kullanılabilir temalardan birini seçin.",
      defaultMode: "Açık, koyu veya sistem modunu seçin.",
      displayName: "1 ile {max} karakter arasında bir görünen ad girin.",
      logoType: "SVG veya PNG dosyası yükleyin.",
      logoSize: "Logo en fazla {max} KB olmalıdır.",
      logoHeight: "Logo en az {min} piksel yüksekliğinde olmalıdır.",
      logoAspect: "Logonun oranı (genişlik : yükseklik) 1:1 ile {max}:1 arasında olmalıdır.",
      logoUnsafe: "Bu SVG komut dosyaları veya harici başvurular içerdiğinden kullanılamaz.",
    },
  },
};

export default messages;
