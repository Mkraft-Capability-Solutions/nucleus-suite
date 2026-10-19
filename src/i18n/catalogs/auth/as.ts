/** "auth" catalog, as. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "লগ ইন | Nucleus HRMS",
  },
  heading: "লগ ইন কৰক",
  subheading: "পুনৰ স্বাগতম। আপোনাৰ কৰ্মস্থানৰ একাউণ্ট ব্যৱহাৰ কৰক।",
  email: {
    label: "কৰ্মস্থানৰ ইমেইল",
  },
  password: {
    label: "পাছৱৰ্ড",
    show: "পাছৱৰ্ড দেখুৱাওক",
    hide: "পাছৱৰ্ড লুকুৱাওক",
  },
  forgot: "পাছৱৰ্ড পাহৰিলে?",
  submit: "লগ ইন কৰক",
  submitting: "লগ ইন হৈ আছে…",
  status: {
    signedIn: "ছাইন ইন হ'ল। আপোনাৰ ৱৰ্কস্পেচ খোল খাইছে…",
  },
  errors: {
    emailRequired: "আপোনাৰ কৰ্মস্থানৰ ইমেইল দিয়ক।",
    emailInvalid: "এটা বৈধ ইমেইল ঠিকনা দিয়ক, যেনে name@company.com।",
    passwordRequired: "আপোনাৰ পাছৱৰ্ড দিয়ক।",
    network: "ছাৰ্ভাৰৰ সৈতে সংযোগ কৰিব পৰা নগ'ল। সংযোগ পৰীক্ষা কৰি পুনৰ চেষ্টা কৰক।",
    unexpected: "লগ ইন বিফল হ'ল (HTTP {status})। অনুগ্ৰহ কৰি পুনৰ চেষ্টা কৰক।",
  },
};

export default messages;
