/** "auth" catalog, ml. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "ലോഗിൻ | Nucleus HRMS",
  },
  heading: "ലോഗിൻ ചെയ്യുക",
  subheading: "വീണ്ടും സ്വാഗതം. നിങ്ങളുടെ ഔദ്യോഗിക അക്കൗണ്ട് ഉപയോഗിക്കുക.",
  email: {
    label: "ഔദ്യോഗിക ഇമെയിൽ",
  },
  password: {
    label: "പാസ്‌വേഡ്",
    show: "പാസ്‌വേഡ് കാണിക്കുക",
    hide: "പാസ്‌വേഡ് മറയ്ക്കുക",
  },
  forgot: "പാസ്‌വേഡ് മറന്നോ?",
  submit: "ലോഗിൻ ചെയ്യുക",
  submitting: "ലോഗിൻ ചെയ്യുന്നു…",
  status: {
    signedIn: "സൈൻ ഇൻ ചെയ്തു. നിങ്ങളുടെ വർക്ക്‌സ്‌പേസ് തുറക്കുന്നു…",
  },
  errors: {
    emailRequired: "നിങ്ങളുടെ ഔദ്യോഗിക ഇമെയിൽ നൽകുക.",
    emailInvalid: "സാധുവായ ഒരു ഇമെയിൽ വിലാസം നൽകുക, ഉദാ. name@company.com.",
    passwordRequired: "നിങ്ങളുടെ പാസ്‌വേഡ് നൽകുക.",
    network: "സെർവറിലേക്ക് എത്താനായില്ല. കണക്ഷൻ പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.",
    unexpected: "ലോഗിൻ പരാജയപ്പെട്ടു (HTTP {status}). വീണ്ടും ശ്രമിക്കുക.",
  },
};

export default messages;
