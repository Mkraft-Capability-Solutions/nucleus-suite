import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Field = { name: string; required: boolean };
type Entity = { logical: string; physical: string; fields: Map<string, Field> };
type Edge = { parent: string; child: string; column: string; required: boolean };

const diagramDir = join(process.cwd(), "personal_docs", "03-data", "diagrams");
const files = readdirSync(diagramDir).filter((name) => /^\d{2}-.+\.puml$/.test(name) && name !== "00-full-schema.puml").sort();
const physicalName = (name: string) => ({ users: "user", identities: "account", sessions: "session" })[name] ?? name;
const textIdEntities = new Set(["users", "identities", "sessions"]);
const entities = new Map<string, Entity>();
const edges = new Map<string, Edge>();
const sources = files.map((file) => ({ file, source: readFileSync(join(diagramDir, file), "utf8") }));

// Parse all entities before resolving cross-domain relationships.
for (const { source } of sources) {
  for (const match of source.matchAll(/entity\s+"([a-z0-9_]+)"\s+as\s+([a-z0-9_]+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, logical, , body] = match;
    const entity = entities.get(logical) ?? { logical, physical: physicalName(logical), fields: new Map() };
    for (const line of body.split(/\r?\n/)) {
      const field = line.match(/^\s*(\*)?\s*([a-z][a-z0-9_]*)\s*:\s*[^<]+(?:<<([^>]+)>>)?/);
      if (!field || field[2] === "phase" || field[2] === "classification") continue;
      entity.fields.set(field[2], { name: field[2], required: field[1] === "*" });
    }
    entities.set(logical, entity);
  }
}

for (const { source } of sources) {
  for (const line of source.split(/\r?\n/)) {
    const edge = line.match(/^([a-z0-9_]+)\s+([^:]+)--([^:]+)\s+([a-z0-9_]+)\s*:\s*([a-z0-9_]+)\s*$/);
    if (!edge) continue;
    const [, parent, left, right, child, column] = edge;
    if (!entities.has(parent) || !entities.has(child)) continue;
    const required = left.includes("||") && right.includes("{");
    edges.set(`${parent}:${child}:${column}`, { parent, child, column, required });
  }
}

if (entities.size !== 304) throw new Error(`Expected 304 entities, parsed ${entities.size}`);
if (edges.size !== 947) throw new Error(`Expected 947 relationships, parsed ${edges.size}`);
const tenantScopedCount = [...entities.values()].filter((entity) => entity.fields.has("tenant_id")).length;
if (tenantScopedCount !== 291) throw new Error("Expected 291 tenant-scoped tables, parsed " + tenantScopedCount);

const constraintName = (child: string, column: string, parent: string) => {
  const raw = child + "_" + column + "_" + parent + "_fk";
  return raw.length <= 63
    ? raw
    : raw.slice(0, 50) + "_" + createHash("sha1").update(raw).digest("hex").slice(0, 10);
};
const sqlArray = (values: string[]) =>
  "ARRAY[" +
  values.map((value) => "'" + value.replaceAll("'", "''") + "'").join(", ") +
  "]::text[]";
const dollars = "$" + "$";
const mappedAuthEntities = new Set(["users", "identities", "sessions"]);
const physicalTables = [...entities.values()]
  .filter((entity) => !mappedAuthEntities.has(entity.logical))
  .map((entity) => entity.physical)
  .sort();
const tenantTables = [...entities.values()]
  .filter((entity) => entity.fields.has("tenant_id"))
  .map((entity) => entity.physical)
  .sort();
const globalTables = [...entities.values()]
  .filter((entity) => !entity.fields.has("tenant_id"))
  .map((entity) => entity.physical)
  .sort();
const relationshipDefinitions = [...edges.values()]
  .map((edge) => {
    const parent = entities.get(edge.parent)!;
    const child = entities.get(edge.child)!;
    const tenantComposite =
      child.fields.has("tenant_id") &&
      parent.fields.has("tenant_id") &&
      edge.column !== "tenant_id";
    return {
      childTable: child.physical,
      parentTable: parent.physical,
      column: edge.column,
      columnType: textIdEntities.has(edge.parent) ? "text" : "uuid",
      tenantComposite,
      required: edge.required,
      indexName: (child.physical + "_" + edge.column + "_idx").slice(0, 63),
      constraintName: constraintName(child.physical, edge.column, parent.physical),
    };
  })
  .sort((a, b) =>
    (a.childTable + ":" + a.column + ":" + a.parentTable).localeCompare(
      b.childTable + ":" + b.column + ":" + b.parentTable,
    ),
  );

const sql: string[] = [
  "-- Generated from authoritative modular PlantUML. Do not hand-edit.",
  "-- Source parity: 304 logical tables, 947 explicit relationships, 291 tenant-scoped tables.",
  "CREATE OR REPLACE FUNCTION app._migration_has_foreign_key(child_table regclass, parent_table regclass, child_columns text[], parent_columns text[]) RETURNS boolean LANGUAGE sql STABLE SET search_path = pg_catalog AS " +
    dollars +
    " SELECT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.contype = 'f' AND c.conrelid = child_table AND c.confrelid = parent_table AND cardinality(c.conkey) = cardinality(child_columns) AND NOT EXISTS (SELECT 1 FROM unnest(child_columns, parent_columns) AS expected(child_name, parent_name) WHERE NOT EXISTS (SELECT 1 FROM unnest(c.conkey, c.confkey) AS actual(child_attnum, parent_attnum) JOIN pg_attribute child_attribute ON child_attribute.attrelid = c.conrelid AND child_attribute.attnum = actual.child_attnum JOIN pg_attribute parent_attribute ON parent_attribute.attrelid = c.confrelid AND parent_attribute.attnum = actual.parent_attnum WHERE child_attribute.attname::text = expected.child_name AND parent_attribute.attname::text = expected.parent_name))) " +
    dollars +
    ";",
  "DO " +
    dollars +
    " BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN EXECUTE 'CREATE ROLE app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS'; END IF; END " +
    dollars +
    ";",
  "DO " +
    dollars +
    " DECLARE table_name text; BEGIN FOREACH table_name IN ARRAY " +
    sqlArray(physicalTables) +
    " LOOP EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), record_status text NOT NULL DEFAULT ''active'', attributes jsonb NOT NULL DEFAULT ''{}''::jsonb, version bigint NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())', table_name); END LOOP; END " +
    dollars +
    ";",
  "DO " +
    dollars +
    " DECLARE table_name text; policy_name text; BEGIN FOREACH table_name IN ARRAY " +
    sqlArray(tenantTables) +
    " LOOP EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid', table_name); EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', table_name); EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (tenant_id, id)', left(table_name || '_tenant_id_id_uq', 63), table_name); EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)', left(table_name || '_tenant_id_idx', 63), table_name); EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name); EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name); policy_name := left(table_name || '_catalog_isolate', 63); IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = policy_name AND polrelid = to_regclass('public.' || quote_ident(table_name))) THEN EXECUTE format('CREATE POLICY %I ON public.%I USING ((SELECT app.current_tenant_is_authorized(tenant_id))) WITH CHECK ((SELECT app.current_tenant_is_authorized(tenant_id)))', policy_name, table_name); END IF; END LOOP; END " +
    dollars +
    ";",
  "DO " +
    dollars +
    " DECLARE table_name text; BEGIN FOREACH table_name IN ARRAY " +
    sqlArray(tenantTables) +
    " LOOP EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO app_runtime', table_name); END LOOP; FOREACH table_name IN ARRAY " +
    sqlArray(globalTables) +
    " LOOP EXECUTE format('GRANT SELECT ON TABLE public.%I TO app_runtime', table_name); END LOOP; END " +
    dollars +
    ";",
  "DO " +
    dollars +
    " DECLARE edge jsonb; child_columns text[]; parent_columns text[]; child_definition text; parent_definition text; BEGIN FOR edge IN SELECT value FROM jsonb_array_elements('" +
    JSON.stringify(relationshipDefinitions).replaceAll("'", "''") +
    "'::jsonb) LOOP EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', edge->>'childTable', edge->>'column', edge->>'columnType'); IF (edge->>'required')::boolean THEN EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', edge->>'childTable', edge->>'column'); END IF; IF (edge->>'tenantComposite')::boolean THEN child_columns := ARRAY['tenant_id', edge->>'column']; parent_columns := ARRAY['tenant_id', 'id']; child_definition := format('%I, %I', 'tenant_id', edge->>'column'); parent_definition := format('%I, %I', 'tenant_id', 'id'); ELSE child_columns := ARRAY[edge->>'column']; parent_columns := ARRAY['id']; child_definition := format('%I', edge->>'column'); parent_definition := format('%I', 'id'); END IF; EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', edge->>'indexName', edge->>'childTable', child_definition); IF NOT app._migration_has_foreign_key(to_regclass('public.' || quote_ident(edge->>'childTable')), to_regclass('public.' || quote_ident(edge->>'parentTable')), child_columns, parent_columns) THEN EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES public.%I (%s) ON DELETE RESTRICT', edge->>'childTable', edge->>'constraintName', child_definition, edge->>'parentTable', parent_definition); END IF; END LOOP; END " +
    dollars +
    ";",
  "DROP FUNCTION app._migration_has_foreign_key(regclass, regclass, text[], text[]);",
  "COMMENT ON SCHEMA public IS 'MKraft canonical schema: 304 PlantUML entities, 947 declared relationships, 291 tenant-scoped tables; Better Auth maps users/identities/sessions to user/account/session.';",
];
const migration = sql.join("\n--> statement-breakpoint\n") + "\n";
writeFileSync(join(process.cwd(), "db", "migrations", "0008_canonical_304_topology.sql"), migration);
const requiredColumns = relationshipDefinitions
  .filter((relationship) => relationship.required && relationship.column !== "tenant_id")
  .map(({ childTable, column }) => ({ childTable, column }));
const integritySql = [
  "-- Enforce PlantUML-required tenant and relationship keys after canonical topology deployment.",
  "DO " +
    dollars +
    " DECLARE table_name text; BEGIN FOREACH table_name IN ARRAY " +
    sqlArray(tenantTables) +
    " LOOP EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', table_name); END LOOP; END " +
    dollars +
    ";",
  "DO " +
    dollars +
    " DECLARE required_column jsonb; BEGIN FOR required_column IN SELECT value FROM jsonb_array_elements('" +
    JSON.stringify(requiredColumns).replaceAll("'", "''") +
    "'::jsonb) LOOP EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', required_column->>'childTable', required_column->>'column'); END LOOP; END " +
    dollars +
    ";",
].join("\n--> statement-breakpoint\n") + "\n";
writeFileSync(
  join(process.cwd(), "db", "migrations", "0009_canonical_required_keys.sql"),
  integritySql,
);
mkdirSync(join(process.cwd(), "db", "schema"), { recursive: true });
writeFileSync(join(process.cwd(), "db", "schema", "canonical-manifest.json"), JSON.stringify({
  sourceFiles: files,
  logicalTableCount: entities.size,
  relationshipCount: edges.size,
  tenantScopedTableCount: tenantScopedCount,
  tables: [...entities.values()].map(({ logical, physical, fields }) => ({ logical, physical, tenantScoped: fields.has("tenant_id"), fields: [...fields.keys()].sort() })).sort((a, b) => a.logical.localeCompare(b.logical)),
  relationships: [...edges.values()].sort((a, b) => (a.child + ":" + a.column + ":" + a.parent).localeCompare(b.child + ":" + b.column + ":" + b.parent)),
}, null, 2) + "\n");
console.info(`Generated ${entities.size} tables, ${edges.size} relationships, ${sql.length} statements.`);