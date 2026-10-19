/** "auth" catalog, de. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Anmelden | Nucleus HRMS",
  },
  heading: "Anmelden",
  subheading: "Willkommen zurück. Verwenden Sie Ihr Arbeitskonto.",
  email: {
    label: "Geschäftliche E-Mail",
  },
  password: {
    label: "Passwort",
    show: "Passwort anzeigen",
    hide: "Passwort ausblenden",
  },
  forgot: "Passwort vergessen?",
  submit: "Anmelden",
  submitting: "Anmeldung läuft …",
  status: {
    signedIn: "Angemeldet. Ihr Arbeitsbereich wird geöffnet…",
  },
  errors: {
    emailRequired: "Geben Sie Ihre geschäftliche E-Mail-Adresse ein.",
    emailInvalid: "Geben Sie eine gültige E-Mail-Adresse ein, z. B. name@company.com.",
    passwordRequired: "Geben Sie Ihr Passwort ein.",
    network: "Der Server ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
    unexpected: "Anmeldung fehlgeschlagen (HTTP {status}). Bitte versuchen Sie es erneut.",
  },
};

export default messages;
