/**
 * "auth" catalog, English source of truth. Log in screen.
 * Every other locale file must match this shape (type AuthMessages); keys are camelCase segments.
 */
import type { MessageTree } from '../../catalog';

const messages = {
  meta: {
    title: "Log in | Nucleus HRMS",
  },
  heading: "Log in",
  subheading: "Welcome back. Use your work account.",
  email: {
    label: "Work email",
  },
  password: {
    label: "Password",
    show: "Show password",
    hide: "Hide password",
  },
  forgot: "Forgot password?",
  submit: "Log in",
  submitting: "Logging in…",
  status: {
    signedIn: "Signed in. Opening your workspace…",
  },
  errors: {
    emailRequired: "Enter your work email.",
    emailInvalid: "Enter a valid email address, like name@company.com.",
    passwordRequired: "Enter your password.",
    network: "The server could not be reached. Check your connection and try again.",
    unexpected: "Log in failed (HTTP {status}). Please try again.",
  },
} as const;

export type AuthMessages = MessageTree<typeof messages>;
export default messages;
