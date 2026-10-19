/** "auth" catalog, th. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "เข้าสู่ระบบ | Nucleus HRMS",
  },
  heading: "เข้าสู่ระบบ",
  subheading: "ยินดีต้อนรับกลับ ใช้บัญชีที่ทำงานของคุณ",
  email: {
    label: "อีเมลที่ทำงาน",
  },
  password: {
    label: "รหัสผ่าน",
    show: "แสดงรหัสผ่าน",
    hide: "ซ่อนรหัสผ่าน",
  },
  forgot: "ลืมรหัสผ่านใช่ไหม",
  submit: "เข้าสู่ระบบ",
  submitting: "กำลังเข้าสู่ระบบ…",
  status: {
    signedIn: "เข้าสู่ระบบแล้ว กำลังเปิดพื้นที่ทำงานของคุณ…",
  },
  errors: {
    emailRequired: "ป้อนอีเมลที่ทำงานของคุณ",
    emailInvalid: "ป้อนอีเมลที่ถูกต้อง เช่น name@company.com",
    passwordRequired: "ป้อนรหัสผ่านของคุณ",
    network: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง",
    unexpected: "เข้าสู่ระบบไม่สำเร็จ (HTTP {status}) โปรดลองอีกครั้ง",
  },
};

export default messages;
