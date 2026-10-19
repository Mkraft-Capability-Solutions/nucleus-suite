/** "auth" catalog, ko. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "로그인 | Nucleus HRMS",
  },
  heading: "로그인",
  subheading: "다시 오신 것을 환영합니다. 업무용 계정을 사용하세요.",
  email: {
    label: "업무용 이메일",
  },
  password: {
    label: "비밀번호",
    show: "비밀번호 표시",
    hide: "비밀번호 숨기기",
  },
  forgot: "비밀번호를 잊으셨나요?",
  submit: "로그인",
  submitting: "로그인 중…",
  status: {
    signedIn: "로그인되었습니다. 워크스페이스를 여는 중…",
  },
  errors: {
    emailRequired: "업무용 이메일을 입력하세요.",
    emailInvalid: "올바른 이메일 주소를 입력하세요(예: name@company.com).",
    passwordRequired: "비밀번호를 입력하세요.",
    network: "서버에 연결할 수 없습니다. 연결을 확인한 후 다시 시도하세요.",
    unexpected: "로그인하지 못했습니다(HTTP {status}). 다시 시도하세요.",
  },
};

export default messages;
