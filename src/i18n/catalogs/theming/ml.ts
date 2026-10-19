/** "theming" catalog, ml. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "രൂപം മാറ്റുക",
    title: "രൂപം",
    themeLegend: "തീം",
    modeLegend: "മോഡ്",
  },
  modes: {
    light: "ലൈറ്റ്",
    dark: "ഡാർക്ക്",
    system: "സിസ്റ്റം",
  },
  themes: {
    horizon: "ചക്രവാളം",
    signature: "സിഗ്നേച്ചർ",
    sapphireTide: "ഇന്ദ്രനീല തിര",
    emeraldGrove: "മരതകത്തോപ്പ്",
    saffronEmber: "കുങ്കുമക്കനൽ",
    roseQuartz: "റോസ് സ്ഫടികം",
    platinum: "പ്ലാറ്റിനം",
  },
  logo: {
    alt: "{name} ലോഗോ",
  },
  branding: {
    errors: {
      themeId: "ലഭ്യമായ തീമുകളിൽ ഒന്ന് തിരഞ്ഞെടുക്കുക.",
      defaultMode: "ലൈറ്റ്, ഡാർക്ക് അല്ലെങ്കിൽ സിസ്റ്റം മോഡ് തിരഞ്ഞെടുക്കുക.",
      displayName: "1 മുതൽ {max} പ്രതീകങ്ങൾ വരെയുള്ള ഒരു പ്രദർശന നാമം നൽകുക.",
      logoType: "ഒരു SVG അല്ലെങ്കിൽ PNG ഫയൽ അപ്‌ലോഡ് ചെയ്യുക.",
      logoSize: "ലോഗോ {max} KB അല്ലെങ്കിൽ അതിൽ കുറവായിരിക്കണം.",
      logoHeight: "ലോഗോയ്ക്ക് കുറഞ്ഞത് {min} പിക്സൽ ഉയരം ഉണ്ടായിരിക്കണം.",
      logoAspect: "ലോഗോയുടെ അനുപാതം (വീതി : ഉയരം) 1:1 നും {max}:1 നും ഇടയിലായിരിക്കണം.",
      logoUnsafe: "ഈ SVG-യിൽ സ്ക്രിപ്റ്റുകളോ ബാഹ്യ റഫറൻസുകളോ ഉള്ളതിനാൽ ഇത് ഉപയോഗിക്കാൻ കഴിയില്ല.",
    },
  },
};

export default messages;
