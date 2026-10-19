/** "auth" catalog, es. Machine translation from en.ts; pending native-speaker review before release. */
import type { AuthMessages } from './en';

const messages: AuthMessages = {
  meta: {
    title: "Iniciar sesión | Nucleus HRMS",
  },
  heading: "Iniciar sesión",
  subheading: "Te damos la bienvenida. Usa tu cuenta de trabajo.",
  email: {
    label: "Correo de trabajo",
  },
  password: {
    label: "Contraseña",
    show: "Mostrar contraseña",
    hide: "Ocultar contraseña",
  },
  forgot: "¿Olvidaste tu contraseña?",
  submit: "Iniciar sesión",
  submitting: "Iniciando sesión…",
  status: {
    signedIn: "Sesión iniciada. Abriendo tu espacio de trabajo…",
  },
  errors: {
    emailRequired: "Introduce tu correo de trabajo.",
    emailInvalid: "Introduce un correo válido, como name@company.com.",
    passwordRequired: "Introduce tu contraseña.",
    network: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.",
    unexpected: "No se pudo iniciar sesión (HTTP {status}). Inténtalo de nuevo.",
  },
};

export default messages;
