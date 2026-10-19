/** "auth" catalog, id. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Masuk | Nucleus HRMS",
  },
  heading: "Masuk",
  subheading: "Selamat datang kembali. Gunakan akun kerja Anda.",
  email: {
    label: "Email kerja",
  },
  password: {
    label: "Kata sandi",
    show: "Tampilkan kata sandi",
    hide: "Sembunyikan kata sandi",
  },
  forgot: "Lupa kata sandi?",
  submit: "Masuk",
  submitting: "Sedang masuk…",
  status: {
    signedIn: "Berhasil masuk. Membuka ruang kerja Anda…",
  },
  errors: {
    emailRequired: "Masukkan email kerja Anda.",
    emailInvalid: "Masukkan alamat email yang valid, misalnya name@company.com.",
    passwordRequired: "Masukkan kata sandi Anda.",
    network: "Server tidak dapat dijangkau. Periksa koneksi Anda lalu coba lagi.",
    unexpected: "Gagal masuk (HTTP {status}). Silakan coba lagi.",
  },
};

export default messages;
