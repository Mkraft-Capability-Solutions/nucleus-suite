/** "auth" catalog, ru. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Вход | Nucleus HRMS",
  },
  heading: "Вход",
  subheading: "С возвращением. Используйте рабочую учётную запись.",
  email: {
    label: "Рабочая почта",
  },
  password: {
    label: "Пароль",
    show: "Показать пароль",
    hide: "Скрыть пароль",
  },
  forgot: "Забыли пароль?",
  submit: "Войти",
  submitting: "Выполняется вход…",
  status: {
    signedIn: "Вход выполнен. Открываем ваше рабочее пространство…",
  },
  errors: {
    emailRequired: "Введите рабочую почту.",
    emailInvalid: "Введите корректный адрес, например name@company.com.",
    passwordRequired: "Введите пароль.",
    network: "Не удалось связаться с сервером. Проверьте подключение и повторите попытку.",
    unexpected: "Не удалось войти (HTTP {status}). Повторите попытку.",
  },
};

export default messages;
