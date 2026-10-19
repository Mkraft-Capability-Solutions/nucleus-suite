/** "auth" catalog, ar. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "تسجيل الدخول | Nucleus HRMS",
  },
  heading: "تسجيل الدخول",
  subheading: "مرحبًا بعودتك. استخدم حساب العمل الخاص بك.",
  email: {
    label: "البريد الإلكتروني للعمل",
  },
  password: {
    label: "كلمة المرور",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
  },
  forgot: "هل نسيت كلمة المرور؟",
  submit: "تسجيل الدخول",
  submitting: "جارٍ تسجيل الدخول…",
  status: {
    signedIn: "تم تسجيل الدخول. جارٍ فتح مساحة عملك…",
  },
  errors: {
    emailRequired: "أدخل البريد الإلكتروني للعمل.",
    emailInvalid: "أدخل عنوان بريد إلكتروني صالحًا، مثل name@company.com.",
    passwordRequired: "أدخل كلمة المرور.",
    network: "تعذّر الوصول إلى الخادم. تحقّق من اتصالك وحاول مرة أخرى.",
    unexpected: "تعذّر تسجيل الدخول (HTTP {status}). يُرجى المحاولة مرة أخرى.",
  },
};

export default messages;
