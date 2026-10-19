/** "auth" catalog, hi. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "लॉग इन | Nucleus HRMS",
  },
  heading: "लॉग इन करें",
  subheading: "फिर से स्वागत है। अपने कार्य खाते का उपयोग करें।",
  email: {
    label: "कार्य ईमेल",
  },
  password: {
    label: "पासवर्ड",
    show: "पासवर्ड दिखाएँ",
    hide: "पासवर्ड छिपाएँ",
  },
  forgot: "पासवर्ड भूल गए?",
  submit: "लॉग इन करें",
  submitting: "लॉग इन हो रहा है…",
  status: {
    signedIn: "साइन इन हो गया। आपका वर्कस्पेस खुल रहा है…",
  },
  errors: {
    emailRequired: "अपना कार्य ईमेल दर्ज करें।",
    emailInvalid: "मान्य ईमेल पता दर्ज करें, जैसे name@company.com।",
    passwordRequired: "अपना पासवर्ड दर्ज करें।",
    network: "सर्वर से संपर्क नहीं हो सका। अपना कनेक्शन जाँचें और फिर से प्रयास करें।",
    unexpected: "लॉग इन विफल रहा (HTTP {status})। कृपया फिर से प्रयास करें।",
  },
};

export default messages;
