import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { databaseConfigured, db, sqlClient } from "@/lib/db";
import { schema } from "@/lib/db/schema";
import {
  bootstrapInitialTenant,
  initialAdminSignupAvailable,
} from "@/server/identity/provision";

const baseUrl = process.env.BETTER_AUTH_URL;
const allowInitialAdminSignup =
  databaseConfigured && process.env.ALLOW_INITIAL_ADMIN_SIGNUP === "true";
const setupSecret = "mkraft-unconfigured-build-secret-not-valid-for-deployment";
const localDevelopmentOrigins = process.env.NODE_ENV === "production"
  ? []
  : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3100", "http://127.0.0.1:3100"];

export const auth = betterAuth({
  appName: "MKraft HRMS",
  baseURL: baseUrl ?? (databaseConfigured ? undefined : "http://localhost:3000"),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (databaseConfigured ? undefined : setupSecret),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: !allowInitialAdminSignup,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 15 * 60,
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }, request) => {
      await sqlClient`
        insert into auth_security_events (
          actor_user_id, target_user_id, event_type, ip_address, user_agent
        ) values (
          ${user.id}, ${user.id}, 'password_reset',
          ${request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null},
          ${request?.headers.get("user-agent") ?? null}
        )
      `;
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!allowInitialAdminSignup || !(await initialAdminSignupAvailable())) return false;
          return { data: { ...user, email: user.email.trim().toLowerCase() } };
        },
        after: async (user) => {
          await bootstrapInitialTenant({ id: user.id, name: user.name, email: user.email });
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    deferSessionRefresh: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60 * 10, max: 5 },
      "/request-password-reset": { window: 60 * 10, max: 3 },
      "/reset-password": { window: 60 * 10, max: 5 },
    },
  },
  trustedOrigins: [
    ...(baseUrl ? [baseUrl] : databaseConfigured ? [] : ["http://localhost:3000"]),
    ...localDevelopmentOrigins,
    // Explicit, empty-by-default allowlist for preview/test harnesses
    // (e.g. the Playwright webServer origin). Never widens production auth.
    ...(process.env.ADDITIONAL_TRUSTED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []),
  ],
  advanced: {
    cookiePrefix: "mkraft",
    useSecureCookies: baseUrl?.startsWith("https://") ?? false,
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  plugins: [nextCookies()],
});
