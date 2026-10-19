/** "auth" catalog, mai. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "लॉग इन | Nucleus HRMS",
  },
  heading: "लॉग इन करू",
  subheading: "फेर सँ स्वागत अछि। अपन कार्यालयी खाता प्रयोग करू।",
  email: {
    label: "कार्यालयी ईमेल",
  },
  password: {
    label: "पासवर्ड",
    show: "पासवर्ड देखाउ",
    hide: "पासवर्ड नुकाउ",
  },
  forgot: "पासवर्ड बिसरि गेलहुँ?",
  submit: "लॉग इन करू",
  submitting: "लॉग इन भ' रहल अछि…",
  status: {
    signedIn: "साइन इन भ' गेल। अहाँक वर्कस्पेस खुजि रहल अछि…",
  },
  errors: {
    emailRequired: "अपन कार्यालयी ईमेल लिखू।",
    emailInvalid: "मान्य ईमेल पता लिखू, जेना name@company.com।",
    passwordRequired: "अपन पासवर्ड लिखू।",
    network: "सर्वर सँ सम्पर्क नहि भ' सकल। कनेक्शन जाँचू आ फेर प्रयास करू।",
    unexpected: "लॉग इन असफल (HTTP {status})। कृपया फेर प्रयास करू।",
  },
};

export default messages;
