/** "theming" catalog, ne. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "रूप परिवर्तन गर्नुहोस्",
    title: "रूप",
    themeLegend: "थिम",
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
    saffronEmber: "केसरी अङ्गार",
    roseQuartz: "गुलाबी स्फटिक",
    platinum: "प्लाटिनम",
  },
  logo: {
    alt: "{name} लोगो",
  },
  branding: {
    errors: {
      themeId: "उपलब्ध थिमहरूमध्ये एउटा छान्नुहोस्।",
      defaultMode: "लाइट, डार्क वा सिस्टम मोड छान्नुहोस्।",
      displayName: "1 देखि {max} अक्षरसम्मको प्रदर्शन नाम लेख्नुहोस्।",
      logoType: "SVG वा PNG फाइल अपलोड गर्नुहोस्।",
      logoSize: "लोगो {max} KB वा सोभन्दा सानो हुनुपर्छ।",
      logoHeight: "लोगो कम्तीमा {min} पिक्सेल अग्लो हुनुपर्छ।",
      logoAspect: "लोगोको अनुपात (चौडाइ : उचाइ) 1:1 र {max}:1 को बीचमा हुनुपर्छ।",
      logoUnsafe: "यो SVG मा स्क्रिप्ट वा बाह्य सन्दर्भहरू छन्, त्यसैले यसलाई प्रयोग गर्न सकिँदैन।",
    },
  },
};

export default messages;
