/** "auth" catalog, zh. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "登录 | Nucleus HRMS",
  },
  heading: "登录",
  subheading: "欢迎回来。请使用您的工作账号。",
  email: {
    label: "工作邮箱",
  },
  password: {
    label: "密码",
    show: "显示密码",
    hide: "隐藏密码",
  },
  forgot: "忘记密码？",
  submit: "登录",
  submitting: "正在登录…",
  status: {
    signedIn: "已登录。正在打开你的工作区…",
  },
  errors: {
    emailRequired: "请输入您的工作邮箱。",
    emailInvalid: "请输入有效的邮箱地址，例如 name@company.com。",
    passwordRequired: "请输入您的密码。",
    network: "无法连接服务器。请检查网络连接后重试。",
    unexpected: "登录失败（HTTP {status}）。请重试。",
  },
};

export default messages;
