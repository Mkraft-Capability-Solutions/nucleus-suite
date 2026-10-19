/** "auth" catalog, ne. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "लग इन | Nucleus HRMS",
  },
  heading: "लग इन गर्नुहोस्",
  subheading: "फेरि स्वागत छ। आफ्नो कार्यालय खाता प्रयोग गर्नुहोस्।",
  email: {
    label: "कार्यालय इमेल",
  },
  password: {
    label: "पासवर्ड",
    show: "पासवर्ड देखाउनुहोस्",
    hide: "पासवर्ड लुकाउनुहोस्",
  },
  forgot: "पासवर्ड बिर्सनुभयो?",
  submit: "लग इन गर्नुहोस्",
  submitting: "लग इन हुँदैछ…",
  status: {
    signedIn: "साइन इन भयो। तपाईंको कार्यक्षेत्र खुल्दै छ…",
  },
  errors: {
    emailRequired: "आफ्नो कार्यालय इमेल लेख्नुहोस्।",
    emailInvalid: "मान्य इमेल ठेगाना लेख्नुहोस्, जस्तै name@company.com।",
    passwordRequired: "आफ्नो पासवर्ड लेख्नुहोस्।",
    network: "सर्भरमा पुग्न सकिएन। जडान जाँच गरी फेरि प्रयास गर्नुहोस्।",
    unexpected: "लग इन असफल भयो (HTTP {status})। कृपया फेरि प्रयास गर्नुहोस्।",
  },
};

export default messages;
