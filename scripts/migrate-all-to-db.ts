import { Pool } from "pg";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

config({ path: [process.env.NUCLEUS_ENV_FILE || ".env.local", ".env"], quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 5,
  connectionTimeoutMillis: 15000,
});

async function main() {
  console.log("Starting Database Migration of all JSON Configurations, Enums, Picklists, and Catalogs...");

  const uiDir = join(process.cwd(), "src/config/ui");
  const files = readdirSync(uiDir).filter((f) => f.endsWith(".json"));

  console.log(`Found ${files.length} UI config files in ${uiDir}`);

  // 1. Process all UI config files
  let processedConfigs = 0;
  for (const file of files) {
    const resourceKey = file.replace(/\.json$/, "");
    const filePath = join(uiDir, file);
    const content = JSON.parse(readFileSync(filePath, "utf8"));
    const jsonString = JSON.stringify(content);

    // Insert definition first (due to foreign key constraint)
    await pool.query(
      `INSERT INTO configuration_definitions (key, value_type, public_readable)
       VALUES ($1, 'text', true)
       ON CONFLICT (key) DO NOTHING`,
      [resourceKey]
    );

    // Insert or update system configuration value
    await pool.query(
      `INSERT INTO system_configuration_values (key, value, revision, updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, revision = system_configuration_values.revision + 1, updated_at = NOW()`,
      [resourceKey, jsonString]
    );

    processedConfigs++;
  }

  // 2. Process other core configs if present
  const otherConfigs = [
    { key: "appearance", path: "src/config/appearance.json" },
    { key: "assistant", path: "src/config/assistant.json" },
    { key: "public-site", path: "src/config/public-site.json" },
    { key: "workbook", path: "scripts/seeds/workbook.json" },
  ];

  for (const cfg of otherConfigs) {
    const fullPath = join(process.cwd(), cfg.path);
    if (existsSync(fullPath)) {
      const content = JSON.parse(readFileSync(fullPath, "utf8"));
      const jsonString = JSON.stringify(content);

      await pool.query(
        `INSERT INTO configuration_definitions (key, value_type, public_readable)
         VALUES ($1, 'text', true)
         ON CONFLICT (key) DO NOTHING`,
        [cfg.key]
      );

      await pool.query(
        `INSERT INTO system_configuration_values (key, value, revision, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, revision = system_configuration_values.revision + 1, updated_at = NOW()`,
        [cfg.key, jsonString]
      );

      console.log(`Saved core config: ${cfg.key}`);
    }
  }

  // 2b. Process localized assistant and public-site configs for all 11 locales
  const supportedLocales = ['en', 'hi', 'mr', 'ta', 'te', 'bn', 'es', 'fr', 'de', 'ja', 'ar'];
  for (const loc of supportedLocales) {
    const assistantLocPath = join(process.cwd(), `src/locales/${loc}/assistant.json`);
    if (existsSync(assistantLocPath)) {
      const assistantKey = `assistant_${loc}`;
      const jsonStr = readFileSync(assistantLocPath, 'utf8');
      await pool.query(
        `INSERT INTO configuration_definitions (key, value_type, public_readable)
         VALUES ($1, 'text', true)
         ON CONFLICT (key) DO NOTHING`,
        [assistantKey]
      );
      await pool.query(
        `INSERT INTO system_configuration_values (key, value, revision, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, revision = system_configuration_values.revision + 1, updated_at = NOW()`,
        [assistantKey, jsonStr]
      );
    }

    const publicLocPath = join(process.cwd(), `src/locales/${loc}/public.json`);
    if (existsSync(publicLocPath)) {
      const publicLocKey = `public_site_${loc}`;
      const jsonStr = readFileSync(publicLocPath, 'utf8');
      await pool.query(
        `INSERT INTO configuration_definitions (key, value_type, public_readable)
         VALUES ($1, 'text', true)
         ON CONFLICT (key) DO NOTHING`,
        [publicLocKey]
      );
      await pool.query(
        `INSERT INTO system_configuration_values (key, value, revision, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, revision = system_configuration_values.revision + 1, updated_at = NOW()`,
        [publicLocKey, jsonStr]
      );
    }
  }
  console.log(`Saved localized configs for all 11 languages.`);

  // 3. Verify total records in system_configuration_values
  const countRes = await pool.query(
    `SELECT count(*)::int as count FROM system_configuration_values`
  );
  console.log(`\nSuccessfully migrated ${processedConfigs} UI configs into PostgreSQL.`);
  console.log(`Total rows in system_configuration_values: ${countRes.rows[0].count}`);

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  pool.end();
  process.exit(1);
});
