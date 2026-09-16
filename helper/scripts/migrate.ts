import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const configuration = readRuntimeConfiguration();
  const configurationProblems = migrationConfigurationProblems(configuration);
  if (configurationProblems.length > 0) {
    throw new Error(`Migration configuration error: ${configurationProblems.join("; ")}`);
  }

  const client = neon(configuration.migrationDatabaseUrl!);
  const database = drizzle(client);

  await migrate(database, { migrationsFolder: "./db/migrations" });
  console.info("MKraft database migrations applied successfully.");
}

void main();
