import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { identitySchema } from "./identity-schema";
import { schema } from "./schema";
import { readRuntimeConfiguration } from "../runtime-config";

const configuration = readRuntimeConfiguration();

const databaseUrl =
  configuration.databaseUrl ??
  "postgresql://mkraft:configuration-required@localhost:5432/mkraft";

export const databaseConfigured = Boolean(configuration.databaseUrl);
export const sqlClient = neon(databaseUrl);
export const db = drizzle(sqlClient, { schema: { ...schema, ...identitySchema } });

