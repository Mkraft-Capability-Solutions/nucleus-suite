/** "theming" catalog, ar. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "تغيير المظهر",
    title: "المظهر",
    themeLegend: "السمة",
    modeLegend: "الوضع",
  },
  modes: {
    light: "فاتح",
    dark: "داكن",
    system: "النظام",
  },
  themes: {
    horizon: "الأفق",
    signature: "التوقيع",
    sapphireTide: "مدّ الياقوت",
    emeraldGrove: "بستان الزمرد",
    saffronEmber: "جمرة الزعفران",
    roseQuartz: "الكوارتز الوردي",
    platinum: "البلاتين",
  },
  logo: {
    alt: "شعار {name}",
  },
  branding: {
    errors: {
      themeId: "اختر إحدى السمات المتاحة.",
      defaultMode: "اختر الوضع الفاتح أو الداكن أو وضع النظام.",
      displayName: "أدخل اسم عرض من 1 إلى {max} حرفًا.",
      logoType: "ارفع ملف SVG أو PNG.",
      logoSize: "يجب ألا يتجاوز حجم الشعار {max} كيلوبايت.",
      logoHeight: "يجب ألا يقل ارتفاع الشعار عن {min} بكسل.",
      logoAspect: "يجب أن تكون نسبة الشعار (العرض : الارتفاع) بين 1:1 و{max}:1.",
      logoUnsafe: "يحتوي ملف SVG هذا على نصوص برمجية أو مراجع خارجية ولا يمكن استخدامه.",
    },
  },
};

export default messages;
