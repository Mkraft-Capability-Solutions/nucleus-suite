/** "auth" catalog, vi. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Đăng nhập | Nucleus HRMS",
  },
  heading: "Đăng nhập",
  subheading: "Chào mừng bạn quay lại. Hãy dùng tài khoản công việc của bạn.",
  email: {
    label: "Email công việc",
  },
  password: {
    label: "Mật khẩu",
    show: "Hiện mật khẩu",
    hide: "Ẩn mật khẩu",
  },
  forgot: "Quên mật khẩu?",
  submit: "Đăng nhập",
  submitting: "Đang đăng nhập…",
  status: {
    signedIn: "Đã đăng nhập. Đang mở không gian làm việc của bạn…",
  },
  errors: {
    emailRequired: "Nhập email công việc của bạn.",
    emailInvalid: "Nhập địa chỉ email hợp lệ, ví dụ name@company.com.",
    passwordRequired: "Nhập mật khẩu của bạn.",
    network: "Không thể kết nối tới máy chủ. Hãy kiểm tra kết nối và thử lại.",
    unexpected: "Đăng nhập không thành công (HTTP {status}). Vui lòng thử lại.",
  },
};

export default messages;
