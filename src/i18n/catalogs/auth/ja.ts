/** "auth" catalog, ja. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "ログイン | Nucleus HRMS",
  },
  heading: "ログイン",
  subheading: "おかえりなさい。仕事用のアカウントを使用してください。",
  email: {
    label: "仕事用メールアドレス",
  },
  password: {
    label: "パスワード",
    show: "パスワードを表示",
    hide: "パスワードを隠す",
  },
  forgot: "パスワードをお忘れですか？",
  submit: "ログイン",
  submitting: "ログインしています…",
  status: {
    signedIn: "ログインしました。ワークスペースを開いています…",
  },
  errors: {
    emailRequired: "仕事用メールアドレスを入力してください。",
    emailInvalid: "有効なメールアドレスを入力してください（例: name@company.com）。",
    passwordRequired: "パスワードを入力してください。",
    network: "サーバーに接続できませんでした。接続を確認してもう一度お試しください。",
    unexpected: "ログインに失敗しました（HTTP {status}）。もう一度お試しください。",
  },
};

export default messages;
