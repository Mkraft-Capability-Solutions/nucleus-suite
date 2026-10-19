/** "theming" catalog, th. Machine translation from en.ts; pending native-speaker review before release. */
import type { ThemingMessages } from './en';

const messages: ThemingMessages = {
  switcher: {
    triggerLabel: "เปลี่ยนรูปลักษณ์",
    title: "รูปลักษณ์",
    themeLegend: "ธีม",
    modeLegend: "โหมด",
  },
  modes: {
    light: "สว่าง",
    dark: "มืด",
    system: "ตามระบบ",
  },
  themes: {
    horizon: "ขอบฟ้า",
    signature: "ซิกเนเจอร์",
    sapphireTide: "กระแสไพลิน",
    emeraldGrove: "สวนมรกต",
    saffronEmber: "ถ่านแดงหญ้าฝรั่น",
    roseQuartz: "โรสควอตซ์",
    platinum: "แพลทินัม",
  },
  logo: {
    alt: "โลโก้ {name}",
  },
  branding: {
    errors: {
      themeId: "เลือกธีมที่มีให้หนึ่งธีม",
      defaultMode: "เลือกโหมดสว่าง มืด หรือตามระบบ",
      displayName: "ป้อนชื่อที่แสดงความยาว 1 ถึง {max} อักขระ",
      logoType: "อัปโหลดไฟล์ SVG หรือ PNG",
      logoSize: "โลโก้ต้องมีขนาดไม่เกิน {max} KB",
      logoHeight: "โลโก้ต้องสูงอย่างน้อย {min} พิกเซล",
      logoAspect: "สัดส่วนโลโก้ (กว้าง : สูง) ต้องอยู่ระหว่าง 1:1 ถึง {max}:1",
      logoUnsafe: "SVG นี้มีสคริปต์หรือการอ้างอิงภายนอก จึงไม่สามารถใช้งานได้",
    },
  },
};

export default messages;
