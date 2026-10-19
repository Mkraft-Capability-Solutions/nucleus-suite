/** "theming" catalog, mr. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "स्वरूप बदला",
    title: "स्वरूप",
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
    sapphireTide: "नीलम भरती",
    emeraldGrove: "पाचू उपवन",
    saffronEmber: "केशरी निखारा",
    roseQuartz: "गुलाबी स्फटिक",
    platinum: "प्लॅटिनम",
  },
  logo: {
    alt: "{name} लोगो",
  },
  branding: {
    errors: {
      themeId: "उपलब्ध थीमपैकी एक निवडा.",
      defaultMode: "लाइट, डार्क किंवा सिस्टम मोड निवडा.",
      displayName: "1 ते {max} अक्षरांचे प्रदर्शन नाव प्रविष्ट करा.",
      logoType: "SVG किंवा PNG फाइल अपलोड करा.",
      logoSize: "लोगो {max} KB किंवा त्यापेक्षा लहान असावा.",
      logoHeight: "लोगो किमान {min} पिक्सेल उंच असावा.",
      logoAspect: "लोगोचे गुणोत्तर (रुंदी : उंची) 1:1 ते {max}:1 दरम्यान असावे.",
      logoUnsafe: "या SVG मध्ये स्क्रिप्ट किंवा बाह्य संदर्भ आहेत, त्यामुळे ते वापरता येणार नाही.",
    },
  },
};

export default messages;
