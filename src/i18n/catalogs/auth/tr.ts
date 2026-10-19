/** "auth" catalog, tr. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Oturum aç | Nucleus HRMS",
  },
  heading: "Oturum aç",
  subheading: "Tekrar hoş geldiniz. İş hesabınızı kullanın.",
  email: {
    label: "İş e-postası",
  },
  password: {
    label: "Parola",
    show: "Parolayı göster",
    hide: "Parolayı gizle",
  },
  forgot: "Parolanızı mı unuttunuz?",
  submit: "Oturum aç",
  submitting: "Oturum açılıyor…",
  status: {
    signedIn: "Oturum açıldı. Çalışma alanınız açılıyor…",
  },
  errors: {
    emailRequired: "İş e-postanızı girin.",
    emailInvalid: "name@company.com gibi geçerli bir e-posta adresi girin.",
    passwordRequired: "Parolanızı girin.",
    network: "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip yeniden deneyin.",
    unexpected: "Oturum açılamadı (HTTP {status}). Lütfen yeniden deneyin.",
  },
};

export default messages;
