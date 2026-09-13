# Enterprise migration work and evidence

The canonical blueprint is [ENTERPRISE_HRMS_PLAN.md](../ENTERPRISE_HRMS_PLAN.md). This folder contains generated source inventories and verification evidence; it is excluded from deployment uploads.

- `enterprise-inventory.json`: pages, controllers, components, domains, menu targets, services and declared schema topology.
- `localization-inventory.json`: every string source path in `src/data/ui`, hash and conservative classification; not a published language bundle.
- `frontend-live-gap-register.json`: 4,576 snapshot reads and 99 direct JSX label locations across 68 files. Conditional/generated text needs further semantic review.
- `database-normalization-gaps.json`: 288 JSON columns across 286 tables requiring domain review. Audit/external payloads may appropriately remain JSON; business attributes require explicit schema/projection migration.
- `database-verification.json`: live local PostgreSQL checks with rolled-back synthetic test records and a non-owner application role.

## Reproduce discovery

```sh
node scripts/discover-enterprise.mjs
node scripts/discover-ui-text.mjs
node scripts/database/catalog-localization.mjs
```

## Isolated local database

The current run created a separate PostgreSQL 15 cluster on `127.0.0.1:55432`. Its data directory and generated owner credentials are in ignored `.env.enterprise.local`. The current application `.env.local` was not switched to a database provider. Do not use the migration owner as an application login.

On a new checkout with local PostgreSQL tools installed and port 55432 free:

```sh
node scripts/database/create-local.mjs
```

The creation command refuses to replace an existing enterprise environment. The local cluster lives in a temporary directory and is for disposable development verification, not durable production storage.

Apply/verify the existing isolated database:

```sh
NUCLEUS_ENV_FILE=.env.enterprise.local npm run db:migrate
NUCLEUS_ENV_FILE=.env.enterprise.local npm run db:verify:fresh
NUCLEUS_ENV_FILE=.env.enterprise.local npx tsx scripts/database/verify-live.mts
NUCLEUS_ENV_FILE=.env.enterprise.local npx tsx scripts/database/normalization-report.mts
NUCLEUS_ENV_FILE=.env.enterprise.local npx tsx scripts/database/seed-localization.mts
```

19 ordered migrations applied successfully, creating 331 public tables. Repeat migration verified with immutable hash checks. The English import added 3,344 unpublished label candidates and preserves any existing translations on repeat. No personnel fixtures were migrated into operational tables.

The retired `apply-vp-migration.mjs` now directs callers to the journaled migrator. `restore-demo-reporting-hierarchy.sql` is an explicit synthetic-data repair, outside schema migrations. It must never run as a customer migration or automatic startup action.

## Acceptance not yet achieved

Full 3NF conversion of legacy business attributes, removal of all runtime snapshots, translation hooks on all pages, persistent-session UI integration and end-to-end live enterprise workflows are not implemented by this change. Do not mark Phases 3–5 complete or publish this work as a completed database migration. The user-requested payroll jurisdiction is still awaiting a response.
