/** "theming" catalog, gu. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "દેખાવ બદલો",
    title: "દેખાવ",
    themeLegend: "થીમ",
    modeLegend: "મોડ",
  },
  modes: {
    light: "લાઇટ",
    dark: "ડાર્ક",
    system: "સિસ્ટમ",
  },
  themes: {
    horizon: "ક્ષિતિજ",
    signature: "સિગ્નેચર",
    sapphireTide: "નીલમ ભરતી",
    emeraldGrove: "પન્ના ઉપવન",
    saffronEmber: "કેસરી અંગારો",
    roseQuartz: "ગુલાબી સ્ફટિક",
    platinum: "પ્લેટિનમ",
  },
  logo: {
    alt: "{name} લોગો",
  },
  branding: {
    errors: {
      themeId: "ઉપલબ્ધ થીમમાંથી એક પસંદ કરો.",
      defaultMode: "લાઇટ, ડાર્ક અથવા સિસ્ટમ મોડ પસંદ કરો.",
      displayName: "1 થી {max} અક્ષરોનું પ્રદર્શન નામ દાખલ કરો.",
      logoType: "SVG અથવા PNG ફાઇલ અપલોડ કરો.",
      logoSize: "લોગો {max} KB અથવા તેનાથી નાનો હોવો જોઈએ.",
      logoHeight: "લોગો ઓછામાં ઓછો {min} પિક્સેલ ઊંચો હોવો જોઈએ.",
      logoAspect: "લોગોનો ગુણોત્તર (પહોળાઈ : ઊંચાઈ) 1:1 અને {max}:1 ની વચ્ચે હોવો જોઈએ.",
      logoUnsafe: "આ SVG માં સ્ક્રિપ્ટ અથવા બાહ્ય સંદર્ભો છે, તેથી તેનો ઉપયોગ કરી શકાતો નથી.",
    },
  },
};

export default messages;
