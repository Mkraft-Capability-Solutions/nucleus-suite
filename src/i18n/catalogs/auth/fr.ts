/** "auth" catalog, fr. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Connexion | Nucleus HRMS",
  },
  heading: "Connexion",
  subheading: "Bon retour parmi nous. Utilisez votre compte professionnel.",
  email: {
    label: "E-mail professionnel",
  },
  password: {
    label: "Mot de passe",
    show: "Afficher le mot de passe",
    hide: "Masquer le mot de passe",
  },
  forgot: "Mot de passe oublié ?",
  submit: "Se connecter",
  submitting: "Connexion en cours…",
  status: {
    signedIn: "Connexion réussie. Ouverture de votre espace de travail…",
  },
  errors: {
    emailRequired: "Saisissez votre e-mail professionnel.",
    emailInvalid: "Saisissez une adresse e-mail valide, par exemple name@company.com.",
    passwordRequired: "Saisissez votre mot de passe.",
    network: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
    unexpected: "Échec de la connexion (HTTP {status}). Veuillez réessayer.",
  },
};

export default messages;
