import { Pool } from "pg";
import { neon } from "@neondatabase/serverless";
import { drizzle as nodeDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { identitySchema } from "./identity-schema";
import { schema } from "./schema";
import { readRuntimeConfiguration } from "../runtime-config";

const configuration = readRuntimeConfiguration();

const databaseUrl =
  configuration.databaseUrl ??
  "postgresql://postgres:H%40rH%40rMahad3v@localhost:5432/nucleus_hrms";

export const databaseConfigured = Boolean(configuration.databaseUrl);

// Create global connection pool singleton for Next.js hot-reloading
const globalForDb = globalThis as unknown as {
  _pgPool?: Pool;
};

export const pool =
  globalForDb._pgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

const isNeon =
  databaseUrl.includes("neon.tech") ||
  process.env.MIGRATION_DATABASE_DRIVER === "neon";

const neonClient = isNeon ? neon(databaseUrl) : null;

export const sqlClient: any = isNeon
  ? neonClient
  : Object.assign(
      async (strings: TemplateStringsArray, ...values: any[]) => {
        let text = strings[0];
        const params: any[] = [];
        for (let i = 0; i < values.length; i++) {
          params.push(values[i]);
          text += `$${i + 1}` + strings[i + 1];
        }
        const res = await pool.query(text, params);
        return res.rows;
      },
      {
        transaction: async (queries: any[]) => {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            const results = [];
            for (const q of queries) {
              if (typeof q === "function") {
                results.push(await q(client));
              } else if (q && q.text) {
                const res = await client.query(q.text, q.values);
                results.push(res.rows);
              }
            }
            await client.query("COMMIT");
            return results;
          } catch (e) {
            await client.query("ROLLBACK");
            throw e;
          } finally {
            client.release();
          }
        },
      },
    );

export const db = isNeon
  ? neonDrizzle(neonClient!, { schema: { ...schema, ...identitySchema } })
  : nodeDrizzle(pool, { schema: { ...schema, ...identitySchema } });



