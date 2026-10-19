/** "theming" catalog, id. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Ubah tampilan",
    title: "Tampilan",
    themeLegend: "Tema",
    modeLegend: "Mode",
  },
  modes: {
    light: "Terang",
    dark: "Gelap",
    system: "Sistem",
  },
  themes: {
    horizon: "Cakrawala",
    signature: "Khas",
    sapphireTide: "Pasang Safir",
    emeraldGrove: "Hutan Zamrud",
    saffronEmber: "Bara Kunyit",
    roseQuartz: "Kuarsa Mawar",
    platinum: "Platinum",
  },
  logo: {
    alt: "Logo {name}",
  },
  branding: {
    errors: {
      themeId: "Pilih salah satu tema yang tersedia.",
      defaultMode: "Pilih mode terang, gelap, atau sistem.",
      displayName: "Masukkan nama tampilan berisi 1 hingga {max} karakter.",
      logoType: "Unggah file SVG atau PNG.",
      logoSize: "Ukuran logo maksimal {max} KB.",
      logoHeight: "Tinggi logo minimal {min} piksel.",
      logoAspect: "Rasio logo (lebar : tinggi) harus antara 1:1 dan {max}:1.",
      logoUnsafe: "SVG ini berisi skrip atau referensi eksternal dan tidak dapat digunakan.",
    },
  },
};

export default messages;
