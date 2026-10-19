/** "auth" catalog, kok. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "लॉग इन | Nucleus HRMS",
  },
  heading: "लॉग इन करात",
  subheading: "परत येवकार. तुमचें कामाचें खातें वापरात.",
  email: {
    label: "कामाचो ईमेल",
  },
  password: {
    label: "पासवर्ड",
    show: "पासवर्ड दाखयात",
    hide: "पासवर्ड लिपयात",
  },
  forgot: "पासवर्ड विसरलो?",
  submit: "लॉग इन करात",
  submitting: "लॉग इन जाता…",
  status: {
    signedIn: "साइन इन जालें. तुमचें वर्कस्पेस उगडटा…",
  },
  errors: {
    emailRequired: "तुमचो कामाचो ईमेल घालात.",
    emailInvalid: "मान्य ईमेल पत्तो घालात, देखीक name@company.com.",
    passwordRequired: "तुमचो पासवर्ड घालात.",
    network: "सर्वराक पावपाक जालें ना. तुमचें कनेक्शन तपासात आनी परत यत्न करात.",
    unexpected: "लॉग इन अयशस्वी (HTTP {status}). उपकार करून परत यत्न करात.",
  },
};

export default messages;
