/** "auth" catalog, pt. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Entrar | Nucleus HRMS",
  },
  heading: "Entrar",
  subheading: "Boas-vindas de volta. Use sua conta de trabalho.",
  email: {
    label: "E-mail de trabalho",
  },
  password: {
    label: "Senha",
    show: "Mostrar senha",
    hide: "Ocultar senha",
  },
  forgot: "Esqueceu a senha?",
  submit: "Entrar",
  submitting: "Entrando…",
  status: {
    signedIn: "Sessão iniciada. Abrindo seu espaço de trabalho…",
  },
  errors: {
    emailRequired: "Informe seu e-mail de trabalho.",
    emailInvalid: "Informe um e-mail válido, como name@company.com.",
    passwordRequired: "Informe sua senha.",
    network: "Não foi possível acessar o servidor. Verifique sua conexão e tente novamente.",
    unexpected: "Falha ao entrar (HTTP {status}). Tente novamente.",
  },
};

export default messages;
