type Environment = Record<string, string | undefined>;

export type RuntimeConfiguration = {
  appUrl?: string;
  databaseUrl?: string;
  authSecret?: string;
  migrationDatabaseUrl?: string;
};

function value(environment: Environment, key: string) {
  const candidate = environment[key]?.trim();
  return candidate || undefined;
}

export function readRuntimeConfiguration(environment: Environment = process.env): RuntimeConfiguration {
  return {
    appUrl: value(environment, "BETTER_AUTH_URL"),
    databaseUrl: value(environment, "DATABASE_URL"),
    authSecret: value(environment, "BETTER_AUTH_SECRET"),
    migrationDatabaseUrl: value(environment, "MIGRATION_DATABASE_URL"),
  };
}

export function runtimeConfigurationProblems(
  configuration: RuntimeConfiguration = readRuntimeConfiguration(),
) {
  if (!configuration.databaseUrl) return ["DATABASE_URL is required"];

  const problems: string[] = [];
  if (!configuration.appUrl) problems.push("BETTER_AUTH_URL is required");
  if (!configuration.authSecret || configuration.authSecret.length < 32) {
    problems.push("BETTER_AUTH_SECRET must be at least 32 characters");
  }
  return problems;
}

export function isPooledNeonUrl(connectionString: string) {
  try {
    return new URL(connectionString).hostname.includes("-pooler.");
  } catch {
    return false;
  }
}

export function migrationConfigurationProblems(
  configuration: RuntimeConfiguration = readRuntimeConfiguration(),
) {
  if (!configuration.migrationDatabaseUrl) return ["MIGRATION_DATABASE_URL is required"];
  if (isPooledNeonUrl(configuration.migrationDatabaseUrl)) {
    return ["MIGRATION_DATABASE_URL must use Neon’s direct, non-pooled endpoint"];
  }
  return [];
}

/** Validates only settings consumed by this checkout, without returning secrets. */
export function environmentProblems(environment: Environment = process.env) {
  const problems: string[] = [];
  const configuration = readRuntimeConfiguration(environment);
  if ((value(environment, "APP_DATA_MODE") || "json") !== "json") {
    problems.push("APP_DATA_MODE must be json; the database workspace provider is not implemented.");
  }
  for (const key of ["DEMO_AUTH_ENABLED", "ALLOW_INITIAL_ADMIN_SIGNUP"]) {
    const flag = value(environment, key);
    if (flag && !["true", "false"].includes(flag)) problems.push(`${key} must be true or false.`);
  }
  for (const [key, min, max] of [["AUTH_COOKIE_MAX_AGE", 300, 604800], ["AI_REQUEST_TIMEOUT_MS", 1000, 120000], ["AI_MAX_RETRIES", 0, 5]] as const) {
    const input = value(environment, key);
    if (input && (!/^\d+$/.test(input) || Number(input) < min || Number(input) > max)) problems.push(`${key} must be an integer between ${min} and ${max}.`);
  }
  const sameSite = value(environment, "AUTH_COOKIE_SAME_SITE");
  if (sameSite && !["lax", "strict"].includes(sameSite)) problems.push("AUTH_COOKIE_SAME_SITE must be lax or strict.");
  const hosted = environment.NETLIFY === "true" || environment.VERCEL === "1";
  const origins = [configuration.appUrl, ...(value(environment, "ADDITIONAL_TRUSTED_ORIGINS")?.split(",").map(origin => origin.trim()) || [])].filter(Boolean) as string[];
  for (const origin of origins) {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || url.hostname.includes("*")) throw new Error();
      if (hosted && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error();
    } catch { problems.push("Authentication origins must be exact HTTP(S) origins; hosted origins must use public HTTPS, without paths, wildcards or credentials."); }
  }
  if (hosted && !configuration.appUrl) problems.push("BETTER_AUTH_URL is required on hosted deployments.");
  if (configuration.databaseUrl) problems.push(...runtimeConfigurationProblems(configuration));
  for (const key of ["DATABASE_URL", "MIGRATION_DATABASE_URL"]) {
    const input = value(environment, key);
    if (!input) continue;
    try { const url = new URL(input); if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) throw new Error(); }
    catch { problems.push(`${key} must be a PostgreSQL connection URL.`); }
  }
  if (configuration.migrationDatabaseUrl) problems.push(...migrationConfigurationProblems(configuration));
  if (environment.ALLOW_INITIAL_ADMIN_SIGNUP === "true" && !configuration.databaseUrl) problems.push("Initial admin signup requires DATABASE_URL.");
  return [...new Set(problems)];
}

/** A buildable preview is not a production-ready customer workspace. */
export function productionReadinessProblems(environment: Environment = process.env) {
  return [...environmentProblems(environment), ...runtimeConfigurationProblems(readRuntimeConfiguration(environment)),
    ...(environment.DEMO_AUTH_ENABLED === "true" ? ["Disable demo authentication before customer production."] : []),
    "Customer release blocked: tenant-scoped workspace reads and durable UI workflow writes are not integrated.",
  ];
}
