import { config } from "dotenv";

import "@testing-library/jest-dom/vitest";

/**
 * Environment before any test file's imports are evaluated.
 *
 * `src/lib/db/index.ts` reads `DATABASE_URL` once, at module scope, and falls back to a
 * localhost placeholder when it is unset — so the connection a test gets is decided by
 * whichever module happened to pull `@/lib/db` first. A suite that imports a service
 * before it imports its own dotenv-loading fixture builds `sqlClient` against localhost
 * and every `tenantTx` then fails with `ECONNREFUSED 127.0.0.1:443`, while raw fixture
 * queries (which build their client later) keep working — a split that reads like a
 * network fault rather than a configuration one.
 *
 * Vitest evaluates this setup file before the test module, so loading here fixes the
 * order for every suite instead of relying on import order that lint is free to re-sort.
 * Nothing is enabled by this: the live suites additionally require MKRAFT_LIVE_VERIFY=1.
 */
config({ path: [".env.local", ".env"], quiet: true });
