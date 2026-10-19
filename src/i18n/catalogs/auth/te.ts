/** "auth" catalog, te. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "లాగిన్ | Nucleus HRMS",
  },
  heading: "లాగిన్ అవ్వండి",
  subheading: "తిరిగి స్వాగతం. మీ ఆఫీస్ ఖాతాను ఉపయోగించండి.",
  email: {
    label: "ఆఫీస్ ఇమెయిల్",
  },
  password: {
    label: "పాస్‌వర్డ్",
    show: "పాస్‌వర్డ్ చూపించు",
    hide: "పాస్‌వర్డ్ దాచు",
  },
  forgot: "పాస్‌వర్డ్ మర్చిపోయారా?",
  submit: "లాగిన్ అవ్వండి",
  submitting: "లాగిన్ అవుతోంది…",
  status: {
    signedIn: "సైన్ ఇన్ అయ్యారు. మీ వర్క్‌స్పేస్ తెరుచుకుంటోంది…",
  },
  errors: {
    emailRequired: "మీ ఆఫీస్ ఇమెయిల్‌ను నమోదు చేయండి.",
    emailInvalid: "చెల్లుబాటు అయ్యే ఇమెయిల్ చిరునామాను నమోదు చేయండి, ఉదా. name@company.com.",
    passwordRequired: "మీ పాస్‌వర్డ్‌ను నమోదు చేయండి.",
    network: "సర్వర్‌ను చేరుకోలేకపోయాము. మీ కనెక్షన్‌ను తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
    unexpected: "లాగిన్ విఫలమైంది (HTTP {status}). దయచేసి మళ్లీ ప్రయత్నించండి.",
  },
};

export default messages;
