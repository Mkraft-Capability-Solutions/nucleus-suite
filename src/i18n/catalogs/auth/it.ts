/** "auth" catalog, it. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Accedi | Nucleus HRMS",
  },
  heading: "Accedi",
  subheading: "Bentornato. Usa il tuo account di lavoro.",
  email: {
    label: "Email di lavoro",
  },
  password: {
    label: "Password",
    show: "Mostra password",
    hide: "Nascondi password",
  },
  forgot: "Password dimenticata?",
  submit: "Accedi",
  submitting: "Accesso in corso…",
  status: {
    signedIn: "Accesso effettuato. Apertura del tuo spazio di lavoro…",
  },
  errors: {
    emailRequired: "Inserisci la tua email di lavoro.",
    emailInvalid: "Inserisci un indirizzo email valido, ad esempio name@company.com.",
    passwordRequired: "Inserisci la password.",
    network: "Impossibile raggiungere il server. Controlla la connessione e riprova.",
    unexpected: "Accesso non riuscito (HTTP {status}). Riprova.",
  },
};

export default messages;
