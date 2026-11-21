import { Pool } from "pg";
import { neon } from "@neondatabase/serverless";
import { drizzle as nodeDrizzle } from "drizzle-orm/node-postgres";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { identitySchema } from "./identity-schema";
import { schema } from "./schema";
import { readRuntimeConfiguration } from "../runtime-config";

const configuration = readRuntimeConfiguration();

// No built-in fallback: without DATABASE_URL, queries fail and callers report
// the database as unavailable (see `databaseConfigured`).
const databaseUrl = configuration.databaseUrl ?? "";

export const databaseConfigured = Boolean(configuration.databaseUrl);

// Create global connection pool singleton for Next.js hot-reloading. The pool
// is keyed by URL so an edited .env.local is picked up without a restart.
const globalForDb = globalThis as unknown as {
  _pgPool?: Pool;
  _pgPoolUrl?: string;
};

if (globalForDb._pgPool && globalForDb._pgPoolUrl !== databaseUrl) {
  void globalForDb._pgPool.end().catch(() => undefined);
  globalForDb._pgPool = undefined;
}

export const pool =
  globalForDb._pgPool ??
  new Pool({
    connectionString: databaseUrl || undefined,
    max: 10,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb._pgPool = pool;
  globalForDb._pgPoolUrl = databaseUrl;
}

const isNeon =
  databaseConfigured &&
  (databaseUrl.includes("neon.tech") ||
    process.env.MIGRATION_DATABASE_DRIVER === "neon");

const neonClient = isNeon ? neon(databaseUrl) : null;

/**
 * Mirrors Neon's query semantics for plain PostgreSQL: a statement is lazy
 * until awaited, so it can be handed to `transaction()` and run there on the
 * transaction's client (with the tenant prelude) instead of executing eagerly.
 */
class LazyQuery implements PromiseLike<any[]> {
  constructor(readonly text: string, readonly values: any[]) {}
  private run(): Promise<any[]> {
    return pool.query(this.text, this.values).then((res) => res.rows);
  }
  then<A = any[], B = never>(
    onfulfilled?: ((rows: any[]) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
  catch<B = never>(onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null) {
    return this.run().catch(onrejected);
  }
  finally(onfinally?: (() => void) | null) {
    return this.run().finally(onfinally);
  }
}

export const sqlClient: any = isNeon
  ? neonClient
  : Object.assign(
      (strings: TemplateStringsArray, ...values: any[]) => {
        let text = strings[0];
        const params: any[] = [];
        for (let i = 0; i < values.length; i++) {
          const value = values[i];
          if (value instanceof LazyQuery) {
            // Nested fragment (sql`... ${sql`${x}::uuid`} ...`): inline it, renumbering its placeholders.
            const offset = params.length;
            text += value.text.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + offset}`);
            params.push(...value.values);
          } else {
            params.push(value);
            text += `$${params.length}`;
          }
          text += strings[i + 1];
        }
        return new LazyQuery(text, params);
      },
      {
        query: (text: string, values: any[] = []) => new LazyQuery(text, values),
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



