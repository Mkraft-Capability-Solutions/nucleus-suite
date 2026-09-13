import { readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { migrationConfigurationProblems, readRuntimeConfiguration } from "../src/lib/runtime-config";

type ManifestTable = {
  logical: string;
  physical: string;
  tenantScoped: boolean;
  fields: string[];
};
type ManifestEdge = {
  parent: string;
  child: string;
  column: string;
  required: boolean;
};
type Manifest = {
  logicalTableCount: number;
  relationshipCount: number;
  tenantScopedTableCount: number;
  tables: ManifestTable[];
  relationships: ManifestEdge[];
};
type TableRow = {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
};
type PolicyRow = { table_name: string; policy_count: number };
type ForeignKeyRow = {
  child_table: string;
  parent_table: string;
  child_columns: string[];
  parent_columns: string[];
  validated: boolean;
};
type IndexRow = {
  table_name: string;
  columns: string[];
  unique_index: boolean;
};
type ColumnRow = {
  table_name: string;
  column_name: string;
  is_nullable: "YES" | "NO";
};

config({ path: [".env.local", ".env"], quiet: true });

const signature = (
  childTable: string,
  parentTable: string,
  childColumns: string[],
  parentColumns: string[],
) => {
  const pairs = childColumns
    .map((column, index) => column + "->" + parentColumns[index])
    .sort()
    .join(",");
  return childTable + "|" + parentTable + "|" + pairs;
};

const hasPrefix = (columns: string[], prefix: string[]) =>
  prefix.every((column, index) => columns[index] === column);

async function main() {
  const configuration = readRuntimeConfiguration();
  const problems = migrationConfigurationProblems(configuration);
  if (problems.length > 0) throw new Error(problems.join("; "));

  const manifest = JSON.parse(
    readFileSync(
      join(process.cwd(), "db", "schema", "canonical-manifest.json"),
      "utf8",
    ),
  ) as Manifest;
  if (
    manifest.logicalTableCount !== 304 ||
    manifest.relationshipCount !== 947 ||
    manifest.tenantScopedTableCount !== 291
  ) {
    throw new Error("Canonical manifest counts do not match the approved PlantUML model.");
  }

  const client = neon(configuration.migrationDatabaseUrl!);
  const [tableRows, policyRows, foreignKeyRows, indexRows, columnRows] = await Promise.all([
    client.query(
      "SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, " +
        "c.relforcerowsecurity AS rls_forced FROM pg_class c " +
        "JOIN pg_namespace n ON n.oid = c.relnamespace " +
        "WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')",
    ),
    client.query(
      "SELECT tablename AS table_name, count(*)::int AS policy_count " +
        "FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename",
    ),
    client.query(
      "SELECT child.relname AS child_table, parent.relname AS parent_table, " +
        "array_agg(child_attribute.attname::text ORDER BY keys.ordinality) AS child_columns, " +
        "array_agg(parent_attribute.attname::text ORDER BY keys.ordinality) AS parent_columns, " +
        "constraint_record.convalidated AS validated " +
        "FROM pg_constraint constraint_record " +
        "JOIN pg_class child ON child.oid = constraint_record.conrelid " +
        "JOIN pg_namespace child_namespace ON child_namespace.oid = child.relnamespace " +
        "JOIN pg_class parent ON parent.oid = constraint_record.confrelid " +
        "CROSS JOIN LATERAL unnest(constraint_record.conkey, constraint_record.confkey) " +
        "WITH ORDINALITY AS keys(child_attnum, parent_attnum, ordinality) " +
        "JOIN pg_attribute child_attribute ON child_attribute.attrelid = child.oid " +
        "AND child_attribute.attnum = keys.child_attnum " +
        "JOIN pg_attribute parent_attribute ON parent_attribute.attrelid = parent.oid " +
        "AND parent_attribute.attnum = keys.parent_attnum " +
        "WHERE constraint_record.contype = 'f' AND child_namespace.nspname = 'public' " +
        "GROUP BY constraint_record.oid, child.relname, parent.relname, constraint_record.convalidated",
    ),
    client.query(
      "SELECT table_record.relname AS table_name, " +
        "array_agg(attribute_record.attname::text ORDER BY key_column.ordinality) AS columns, " +
        "index_record.indisunique AS unique_index " +
        "FROM pg_index index_record " +
        "JOIN pg_class table_record ON table_record.oid = index_record.indrelid " +
        "JOIN pg_namespace table_namespace ON table_namespace.oid = table_record.relnamespace " +
        "CROSS JOIN LATERAL unnest(index_record.indkey) WITH ORDINALITY " +
        "AS key_column(attnum, ordinality) " +
        "JOIN pg_attribute attribute_record ON attribute_record.attrelid = table_record.oid " +
        "AND attribute_record.attnum = key_column.attnum " +
        "WHERE table_namespace.nspname = 'public' " +
        "AND key_column.ordinality <= index_record.indnkeyatts " +
        "GROUP BY index_record.indexrelid, table_record.relname, index_record.indisunique",    ),
    client.query(
      "SELECT table_name, column_name, is_nullable FROM information_schema.columns " +
        "WHERE table_schema = 'public'",
    ),
  ]);

  const tables = new Map(
    (tableRows as TableRow[]).map((row) => [row.table_name, row]),
  );
  const nullableColumns = new Set(
    (columnRows as ColumnRow[])
      .filter((row) => row.is_nullable === "YES")
      .map((row) => row.table_name + "." + row.column_name),
  );
  const policies = new Map(
    (policyRows as PolicyRow[]).map((row) => [row.table_name, row.policy_count]),
  );
  const indexesByTable = new Map<string, IndexRow[]>();
  for (const row of indexRows as IndexRow[]) {
    indexesByTable.set(row.table_name, [
      ...(indexesByTable.get(row.table_name) ?? []),
      row,
    ]);
  }
  const foreignKeys = new Map<string, ForeignKeyRow[]>();
  for (const row of foreignKeyRows as ForeignKeyRow[]) {
    const key = signature(
      row.child_table,
      row.parent_table,
      row.child_columns,
      row.parent_columns,
    );
    foreignKeys.set(key, [...(foreignKeys.get(key) ?? []), row]);
  }
  const tableByLogical = new Map(
    manifest.tables.map((table) => [table.logical, table]),
  );

  const missingTables = manifest.tables
    .filter((table) => !tables.has(table.physical))
    .map((table) => table.logical);
  const tenantSecurityGaps: string[] = [];
  for (const table of manifest.tables.filter((candidate) => candidate.tenantScoped)) {
    const state = tables.get(table.physical);
    const indexes = indexesByTable.get(table.physical) ?? [];
    if (nullableColumns.has(table.physical + ".tenant_id")) {
      tenantSecurityGaps.push(table.logical + ":tenant-nullable");
    }
    if (!state?.rls_enabled || !state.rls_forced) {
      tenantSecurityGaps.push(table.logical + ":RLS");
    }
    if ((policies.get(table.physical) ?? 0) < 1) {
      tenantSecurityGaps.push(table.logical + ":policy");
    }
    if (!indexes.some((index) => hasPrefix(index.columns, ["tenant_id"]))) {
      tenantSecurityGaps.push(table.logical + ":tenant-index");
    }
    if (
      !indexes.some(
        (index) =>
          index.unique_index && hasPrefix(index.columns, ["tenant_id", "id"]),
      )
    ) {
      tenantSecurityGaps.push(table.logical + ":tenant-identity");
    }
  }

  const missingRelationships: string[] = [];
  const unvalidatedRelationships: string[] = [];
  const missingRelationshipIndexes: string[] = [];
  const requiredNullabilityGaps: string[] = [];
  for (const edge of manifest.relationships) {
    const child = tableByLogical.get(edge.child);
    const parent = tableByLogical.get(edge.parent);
    if (!child || !parent) {
      missingRelationships.push(edge.parent + "->" + edge.child + "." + edge.column);
      continue;
    }
    const tenantComposite =
      child.tenantScoped && parent.tenantScoped && edge.column !== "tenant_id";
    const childColumns = tenantComposite
      ? ["tenant_id", edge.column]
      : [edge.column];
    const parentColumns = tenantComposite ? ["tenant_id", "id"] : ["id"];
    const key = signature(
      child.physical,
      parent.physical,
      childColumns,
      parentColumns,
    );
    const matches = foreignKeys.get(key) ?? [];
    const label = edge.parent + "->" + edge.child + "." + edge.column;
    if (edge.required && nullableColumns.has(child.physical + "." + edge.column)) {
      requiredNullabilityGaps.push(label);
    }
    if (matches.length === 0) missingRelationships.push(label);
    if (matches.length > 0 && !matches.some((match) => match.validated)) {
      unvalidatedRelationships.push(label);
    }
    const indexes = indexesByTable.get(child.physical) ?? [];
    if (!indexes.some((index) => hasPrefix(index.columns, childColumns))) {
      missingRelationshipIndexes.push(label);
    }
  }

  const result = {
    canonicalTables: manifest.logicalTableCount,
    physicalCanonicalTables: new Set(
      manifest.tables.map((table) => table.physical),
    ).size,
    publicTables: tables.size,
    relationships: manifest.relationshipCount,
    tenantScopedTables: manifest.tenantScopedTableCount,
    missingTables,
    missingRelationships,
    unvalidatedRelationships,
    missingRelationshipIndexes,
    requiredNullabilityGaps,
    tenantSecurityGaps,
  };
  console.info(JSON.stringify(result, null, 2));

  if (
    missingTables.length > 0 ||
    missingRelationships.length > 0 ||
    unvalidatedRelationships.length > 0 ||
    missingRelationshipIndexes.length > 0 ||
    requiredNullabilityGaps.length > 0 ||
    tenantSecurityGaps.length > 0
  ) {
    throw new Error("Canonical schema verification failed.");
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Canonical schema verification failed.",
  );
  process.exitCode = 1;
});
