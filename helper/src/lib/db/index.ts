import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { identitySchema } from "./identity-schema";
import { schema } from "./schema";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://mkraft:configuration-required@localhost:5432/mkraft";

export const databaseConfigured = Boolean(process.env.DATABASE_URL);
export const sqlClient = neon(databaseUrl);
export const db = drizzle(sqlClient, { schema: { ...schema, ...identitySchema } });

