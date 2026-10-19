/** "auth" catalog, mr. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "लॉग इन | Nucleus HRMS",
  },
  heading: "लॉग इन करा",
  subheading: "पुन्हा स्वागत आहे. तुमचे कार्यालयीन खाते वापरा.",
  email: {
    label: "कार्यालयीन ईमेल",
  },
  password: {
    label: "पासवर्ड",
    show: "पासवर्ड दाखवा",
    hide: "पासवर्ड लपवा",
  },
  forgot: "पासवर्ड विसरलात?",
  submit: "लॉग इन करा",
  submitting: "लॉग इन होत आहे…",
  status: {
    signedIn: "साइन इन झाले. तुमचे वर्कस्पेस उघडत आहे…",
  },
  errors: {
    emailRequired: "तुमचा कार्यालयीन ईमेल प्रविष्ट करा.",
    emailInvalid: "वैध ईमेल पत्ता प्रविष्ट करा, उदा. name@company.com.",
    passwordRequired: "तुमचा पासवर्ड प्रविष्ट करा.",
    network: "सर्व्हरशी संपर्क होऊ शकला नाही. तुमचे कनेक्शन तपासा आणि पुन्हा प्रयत्न करा.",
    unexpected: "लॉग इन अयशस्वी (HTTP {status}). कृपया पुन्हा प्रयत्न करा.",
  },
};

export default messages;
