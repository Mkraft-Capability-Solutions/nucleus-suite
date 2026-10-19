/** "theming" catalog, as. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "ৰূপ সলনি কৰক",
    title: "ৰূপ",
    themeLegend: "থীম",
    modeLegend: "ম'ড",
  },
  modes: {
    light: "লাইট",
    dark: "ডাৰ্ক",
    system: "ছিষ্টেম",
  },
  themes: {
    horizon: "দিগন্ত",
    signature: "ছিগনেচাৰ",
    sapphireTide: "নীলকান্ত জোৱাৰ",
    emeraldGrove: "পান্না উপবন",
    saffronEmber: "জাফৰান অংগাৰ",
    roseQuartz: "গোলাপী স্ফটিক",
    platinum: "প্লেটিনাম",
  },
  logo: {
    alt: "{name} ল'গ'",
  },
  branding: {
    errors: {
      themeId: "উপলব্ধ থীমসমূহৰ এটা বাছনি কৰক।",
      defaultMode: "লাইট, ডাৰ্ক বা ছিষ্টেম ম'ড বাছনি কৰক।",
      displayName: "1ৰ পৰা {max}টা আখৰৰ এটা প্ৰদৰ্শন নাম দিয়ক।",
      logoType: "এটা SVG বা PNG ফাইল আপল'ড কৰক।",
      logoSize: "ল'গ'টো {max} KB বা তাতকৈ সৰু হ'ব লাগিব।",
      logoHeight: "ল'গ'টো অতি কমেও {min} পিক্সেল ওখ হ'ব লাগিব।",
      logoAspect: "ল'গ'ৰ অনুপাত (প্ৰস্থ : উচ্চতা) 1:1 আৰু {max}:1 ৰ ভিতৰত হ'ব লাগিব।",
      logoUnsafe: "এই SVG ত স্ক্ৰিপ্ট বা বাহ্যিক প্ৰসংগ আছে, সেয়েহে ইয়াক ব্যৱহাৰ কৰিব নোৱাৰি।",
    },
  },
};

export default messages;
