/** "theming" catalog, te. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "రూపాన్ని మార్చండి",
    title: "రూపం",
    themeLegend: "థీమ్",
    modeLegend: "మోడ్",
  },
  modes: {
    light: "లైట్",
    dark: "డార్క్",
    system: "సిస్టమ్",
  },
  themes: {
    horizon: "క్షితిజం",
    signature: "సిగ్నేచర్",
    sapphireTide: "నీలమణి అల",
    emeraldGrove: "పచ్చ వనం",
    saffronEmber: "కుంకుమపువ్వు నిప్పు",
    roseQuartz: "గులాబీ స్ఫటికం",
    platinum: "ప్లాటినం",
  },
  logo: {
    alt: "{name} లోగో",
  },
  branding: {
    errors: {
      themeId: "అందుబాటులో ఉన్న థీమ్‌లలో ఒకదాన్ని ఎంచుకోండి.",
      defaultMode: "లైట్, డార్క్ లేదా సిస్టమ్ మోడ్‌ను ఎంచుకోండి.",
      displayName: "1 నుండి {max} అక్షరాల ప్రదర్శన పేరును నమోదు చేయండి.",
      logoType: "SVG లేదా PNG ఫైల్‌ను అప్‌లోడ్ చేయండి.",
      logoSize: "లోగో {max} KB లేదా అంతకంటే తక్కువ ఉండాలి.",
      logoHeight: "లోగో కనీసం {min} పిక్సెల్‌ల ఎత్తు ఉండాలి.",
      logoAspect: "లోగో నిష్పత్తి (వెడల్పు : ఎత్తు) 1:1 మరియు {max}:1 మధ్య ఉండాలి.",
      logoUnsafe: "ఈ SVGలో స్క్రిప్ట్‌లు లేదా బాహ్య సూచనలు ఉన్నాయి, కాబట్టి దీన్ని ఉపయోగించలేరు.",
    },
  },
};

export default messages;
