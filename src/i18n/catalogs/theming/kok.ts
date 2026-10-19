/** "theming" catalog, kok. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "रूप बदलात",
    title: "रूप",
    themeLegend: "थीम",
    modeLegend: "मोड",
  },
  modes: {
    light: "लायट",
    dark: "डार्क",
    system: "सिस्टम",
  },
  themes: {
    horizon: "क्षितीज",
    signature: "सिग्नेचर",
    sapphireTide: "नीलम भरती",
    emeraldGrove: "पाचू उपवन",
    saffronEmber: "केशरी निखार",
    roseQuartz: "गुलाबी स्फटिक",
    platinum: "प्लॅटिनम",
  },
  logo: {
    alt: "{name} लोगो",
  },
  branding: {
    errors: {
      themeId: "उपलब्ध थीमांतली एक वेंचात.",
      defaultMode: "लायट, डार्क वा सिस्टम मोड वेंचात.",
      displayName: "1 ते {max} अक्षरांचें दाखोवपी नांव घालात.",
      logoType: "SVG वा PNG फायल अपलोड करात.",
      logoSize: "लोगो {max} KB वा ताचे परस ल्हान आसूंक जाय.",
      logoHeight: "लोगो उणेंत उणें {min} पिक्सेल उंच आसूंक जाय.",
      logoAspect: "लोगोचें प्रमाण (रुंदाय : उंचाय) 1:1 आनी {max}:1 मदीं आसूंक जाय.",
      logoUnsafe: "ह्या SVG त स्क्रिप्ट वा भायलीं संदर्भां आसात, देखून ताचो वापर करूंक जायना.",
    },
  },
};

export default messages;
