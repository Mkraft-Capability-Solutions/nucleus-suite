/** "theming" catalog, hi. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "रूप-रंग बदलें",
    title: "रूप-रंग",
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
      themeId: "उपलब्ध थीम में से एक चुनें।",
      defaultMode: "लाइट, डार्क या सिस्टम मोड चुनें।",
      displayName: "1 से {max} वर्णों का डिस्प्ले नाम दर्ज करें।",
      logoType: "SVG या PNG फ़ाइल अपलोड करें।",
      logoSize: "लोगो {max} KB या उससे छोटा होना चाहिए।",
      logoHeight: "लोगो कम से कम {min} पिक्सेल ऊँचा होना चाहिए।",
      logoAspect: "लोगो का अनुपात (चौड़ाई : ऊँचाई) 1:1 से {max}:1 के बीच होना चाहिए।",
      logoUnsafe: "इस SVG में स्क्रिप्ट या बाहरी संदर्भ हैं, इसलिए इसका उपयोग नहीं किया जा सकता।",
    },
  },
};

export default messages;
