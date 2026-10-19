/** "theming" catalog, ta. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "தோற்றத்தை மாற்று",
    title: "தோற்றம்",
    themeLegend: "தீம்",
    modeLegend: "பயன்முறை",
  },
  modes: {
    light: "லைட்",
    dark: "டார்க்",
    system: "சிஸ்டம்",
  },
  themes: {
    horizon: "அடிவானம்",
    signature: "சிக்னேச்சர்",
    sapphireTide: "நீலக்கல் அலை",
    emeraldGrove: "மரகதத் தோப்பு",
    saffronEmber: "குங்குமப்பூ கனல்",
    roseQuartz: "ரோஜா படிகம்",
    platinum: "பிளாட்டினம்",
  },
  logo: {
    alt: "{name} லோகோ",
  },
  branding: {
    errors: {
      themeId: "கிடைக்கும் தீம்களில் ஒன்றைத் தேர்ந்தெடுக்கவும்.",
      defaultMode: "லைட், டார்க் அல்லது சிஸ்டம் பயன்முறையைத் தேர்ந்தெடுக்கவும்.",
      displayName: "1 முதல் {max} எழுத்துகள் கொண்ட காட்சிப் பெயரை உள்ளிடவும்.",
      logoType: "SVG அல்லது PNG கோப்பைப் பதிவேற்றவும்.",
      logoSize: "லோகோ {max} KB அல்லது அதற்குக் குறைவாக இருக்க வேண்டும்.",
      logoHeight: "லோகோ குறைந்தது {min} பிக்சல் உயரம் இருக்க வேண்டும்.",
      logoAspect: "லோகோவின் விகிதம் (அகலம் : உயரம்) 1:1 முதல் {max}:1 வரை இருக்க வேண்டும்.",
      logoUnsafe: "இந்த SVG-இல் ஸ்கிரிப்டுகள் அல்லது வெளிப்புறக் குறிப்புகள் உள்ளன, எனவே இதைப் பயன்படுத்த முடியாது.",
    },
  },
};

export default messages;
