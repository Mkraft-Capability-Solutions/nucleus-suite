/** "theming" catalog, it. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "Cambia aspetto",
    title: "Aspetto",
    themeLegend: "Tema",
    modeLegend: "Modalità",
  },
  modes: {
    light: "Chiaro",
    dark: "Scuro",
    system: "Sistema",
  },
  themes: {
    horizon: "Orizzonte",
    signature: "Firma",
    sapphireTide: "Marea Zaffiro",
    emeraldGrove: "Boschetto Smeraldo",
    saffronEmber: "Brace Zafferano",
    roseQuartz: "Quarzo Rosa",
    platinum: "Platino",
  },
  logo: {
    alt: "Logo di {name}",
  },
  branding: {
    errors: {
      themeId: "Scegli uno dei temi disponibili.",
      defaultMode: "Scegli la modalità chiara, scura o di sistema.",
      displayName: "Inserisci un nome visualizzato da 1 a {max} caratteri.",
      logoType: "Carica un file SVG o PNG.",
      logoSize: "Il logo non deve superare {max} KB.",
      logoHeight: "Il logo deve essere alto almeno {min} pixel.",
      logoAspect: "Il rapporto del logo (larghezza : altezza) deve essere compreso tra 1:1 e {max}:1.",
      logoUnsafe: "Questo SVG contiene script o riferimenti esterni e non può essere utilizzato.",
    },
  },
};

export default messages;
