/** "theming" catalog, kn. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "ನೋಟವನ್ನು ಬದಲಿಸಿ",
    title: "ನೋಟ",
    themeLegend: "ಥೀಮ್",
    modeLegend: "ಮೋಡ್",
  },
  modes: {
    light: "ಲೈಟ್",
    dark: "ಡಾರ್ಕ್",
    system: "ಸಿಸ್ಟಮ್",
  },
  themes: {
    horizon: "ದಿಗಂತ",
    signature: "ಸಿಗ್ನೇಚರ್",
    sapphireTide: "ನೀಲಮಣಿ ಅಲೆ",
    emeraldGrove: "ಪಚ್ಚೆ ತೋಪು",
    saffronEmber: "ಕೇಸರಿ ಕೆಂಡ",
    roseQuartz: "ಗುಲಾಬಿ ಸ್ಫಟಿಕ",
    platinum: "ಪ್ಲಾಟಿನಂ",
  },
  logo: {
    alt: "{name} ಲೋಗೋ",
  },
  branding: {
    errors: {
      themeId: "ಲಭ್ಯವಿರುವ ಥೀಮ್‌ಗಳಲ್ಲಿ ಒಂದನ್ನು ಆಯ್ಕೆಮಾಡಿ.",
      defaultMode: "ಲೈಟ್, ಡಾರ್ಕ್ ಅಥವಾ ಸಿಸ್ಟಮ್ ಮೋಡ್ ಆಯ್ಕೆಮಾಡಿ.",
      displayName: "1 ರಿಂದ {max} ಅಕ್ಷರಗಳ ಪ್ರದರ್ಶನ ಹೆಸರನ್ನು ನಮೂದಿಸಿ.",
      logoType: "SVG ಅಥವಾ PNG ಫೈಲ್ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.",
      logoSize: "ಲೋಗೋ {max} KB ಅಥವಾ ಅದಕ್ಕಿಂತ ಕಡಿಮೆ ಇರಬೇಕು.",
      logoHeight: "ಲೋಗೋ ಕನಿಷ್ಠ {min} ಪಿಕ್ಸೆಲ್ ಎತ್ತರವಿರಬೇಕು.",
      logoAspect: "ಲೋಗೋದ ಅನುಪಾತ (ಅಗಲ : ಎತ್ತರ) 1:1 ಮತ್ತು {max}:1 ರ ನಡುವೆ ಇರಬೇಕು.",
      logoUnsafe: "ಈ SVG ಯಲ್ಲಿ ಸ್ಕ್ರಿಪ್ಟ್‌ಗಳು ಅಥವಾ ಬಾಹ್ಯ ಉಲ್ಲೇಖಗಳಿವೆ, ಆದ್ದರಿಂದ ಇದನ್ನು ಬಳಸಲಾಗುವುದಿಲ್ಲ.",
    },
  },
};

export default messages;
