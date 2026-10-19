/** "theming" catalog, mai. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "रूप बदलू",
    title: "रूप",
    themeLegend: "थीम",
    modeLegend: "मोड",
  },
  modes: {
    light: "लाइट",
    dark: "डार्क",
    system: "सिस्टम",
  },
  themes: {
    horizon: "क्षितिज",
    signature: "सिग्नेचर",
    sapphireTide: "नीलम ज्वार",
    emeraldGrove: "पन्ना उपवन",
    saffronEmber: "केसरिया अंगार",
    roseQuartz: "गुलाबी स्फटिक",
    platinum: "प्लैटिनम",
  },
  logo: {
    alt: "{name} लोगो",
  },
  branding: {
    errors: {
      themeId: "उपलब्ध थीम मे सँ एकटा चुनू।",
      defaultMode: "लाइट, डार्क वा सिस्टम मोड चुनू।",
      displayName: "1 सँ {max} अक्षरक प्रदर्शन नाम लिखू।",
      logoType: "SVG वा PNG फाइल अपलोड करू।",
      logoSize: "लोगो {max} KB वा ओहिसँ छोट होयबाक चाही।",
      logoHeight: "लोगो कम सँ कम {min} पिक्सेल ऊँच होयबाक चाही।",
      logoAspect: "लोगोक अनुपात (चौड़ाई : ऊँचाई) 1:1 आ {max}:1 क बीच होयबाक चाही।",
      logoUnsafe: "एहि SVG मे स्क्रिप्ट वा बाहरी सन्दर्भ अछि, तेँ एकर उपयोग नहि कयल जा सकैत अछि।",
    },
  },
};

export default messages;
