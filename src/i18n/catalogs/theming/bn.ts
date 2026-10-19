/** "theming" catalog, bn. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "রূপ পরিবর্তন করুন",
    title: "রূপ",
    themeLegend: "থিম",
    modeLegend: "মোড",
  },
  modes: {
    light: "লাইট",
    dark: "ডার্ক",
    system: "সিস্টেম",
  },
  themes: {
    horizon: "দিগন্ত",
    signature: "সিগনেচার",
    sapphireTide: "নীলকান্ত জোয়ার",
    emeraldGrove: "পান্না কুঞ্জ",
    saffronEmber: "জাফরান অঙ্গার",
    roseQuartz: "গোলাপি স্ফটিক",
    platinum: "প্ল্যাটিনাম",
  },
  logo: {
    alt: "{name} লোগো",
  },
  branding: {
    errors: {
      themeId: "উপলব্ধ থিমগুলির একটি বেছে নিন।",
      defaultMode: "লাইট, ডার্ক বা সিস্টেম মোড বেছে নিন।",
      displayName: "1 থেকে {max} অক্ষরের একটি প্রদর্শন নাম লিখুন।",
      logoType: "একটি SVG বা PNG ফাইল আপলোড করুন।",
      logoSize: "লোগোটি {max} KB বা তার কম হতে হবে।",
      logoHeight: "লোগোটি কমপক্ষে {min} পিক্সেল উঁচু হতে হবে।",
      logoAspect: "লোগোর অনুপাত (প্রস্থ : উচ্চতা) 1:1 থেকে {max}:1 এর মধ্যে হতে হবে।",
      logoUnsafe: "এই SVG-তে স্ক্রিপ্ট বা বাহ্যিক রেফারেন্স রয়েছে, তাই এটি ব্যবহার করা যাবে না।",
    },
  },
};

export default messages;
