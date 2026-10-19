/** "auth" catalog, bn. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "লগ ইন | Nucleus HRMS",
  },
  heading: "লগ ইন করুন",
  subheading: "আবার স্বাগতম। আপনার কাজের অ্যাকাউন্ট ব্যবহার করুন।",
  email: {
    label: "কাজের ইমেল",
  },
  password: {
    label: "পাসওয়ার্ড",
    show: "পাসওয়ার্ড দেখান",
    hide: "পাসওয়ার্ড লুকান",
  },
  forgot: "পাসওয়ার্ড ভুলে গেছেন?",
  submit: "লগ ইন করুন",
  submitting: "লগ ইন হচ্ছে…",
  status: {
    signedIn: "সাইন ইন হয়েছে। আপনার ওয়ার্কস্পেস খোলা হচ্ছে…",
  },
  errors: {
    emailRequired: "আপনার কাজের ইমেল লিখুন।",
    emailInvalid: "একটি বৈধ ইমেল ঠিকানা লিখুন, যেমন name@company.com।",
    passwordRequired: "আপনার পাসওয়ার্ড লিখুন।",
    network: "সার্ভারে পৌঁছানো যায়নি। আপনার সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।",
    unexpected: "লগ ইন ব্যর্থ হয়েছে (HTTP {status})। আবার চেষ্টা করুন।",
  },
};

export default messages;
