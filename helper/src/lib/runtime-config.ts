type Environment = Record<string, string | undefined>;

export type RuntimeConfiguration = {
  appUrl?: string;
  databaseUrl?: string;
  authSecret?: string;
  migrationDatabaseUrl?: string;
  /**
   * Optional. Only Nucleus AI voice sessions need it, and that surface reports
   * its own absence, so it is deliberately not part of
   * `runtimeConfigurationProblems`: the application must still boot and serve
   * every other module without it.
   */
  googleApiKey?: string;
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
    googleApiKey: value(environment, "GOOGLE_API_KEY"),
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
