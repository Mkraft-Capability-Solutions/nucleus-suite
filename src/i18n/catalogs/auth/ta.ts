/** "auth" catalog, ta. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "உள்நுழை | Nucleus HRMS",
  },
  heading: "உள்நுழையவும்",
  subheading: "மீண்டும் வருக. உங்கள் பணிக் கணக்கைப் பயன்படுத்தவும்.",
  email: {
    label: "பணி மின்னஞ்சல்",
  },
  password: {
    label: "கடவுச்சொல்",
    show: "கடவுச்சொல்லைக் காட்டு",
    hide: "கடவுச்சொல்லை மறை",
  },
  forgot: "கடவுச்சொல்லை மறந்துவிட்டீர்களா?",
  submit: "உள்நுழையவும்",
  submitting: "உள்நுழைகிறது…",
  status: {
    signedIn: "உள்நுழைந்துவிட்டீர்கள். உங்கள் பணியிடம் திறக்கப்படுகிறது…",
  },
  errors: {
    emailRequired: "உங்கள் பணி மின்னஞ்சலை உள்ளிடவும்.",
    emailInvalid: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும், எ.கா. name@company.com.",
    passwordRequired: "உங்கள் கடவுச்சொல்லை உள்ளிடவும்.",
    network: "சேவையகத்தை அணுக முடியவில்லை. இணைப்பைச் சரிபார்த்து மீண்டும் முயலவும்.",
    unexpected: "உள்நுழைவு தோல்வியடைந்தது (HTTP {status}). மீண்டும் முயலவும்.",
  },
};

export default messages;
