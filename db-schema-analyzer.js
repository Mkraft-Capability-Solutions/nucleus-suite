const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const sqlDumpPath = path.join(rootDir, 'db', 'backup', 'nucleus-suit.sql');
const schemaTsPath = path.join(rootDir, 'src', 'lib', 'db', 'schema.ts');
const outputPath = path.join(rootDir, 'schema-gap-analysis.json');

console.log('🔍 Starting Strict Two-Way Database Structure Analysis...');

function parseSqlDump(sqlContent) {
  const tables = {};
  
  // Extract CREATE TABLE blocks
  const createTableRegex = /CREATE TABLE (?:public\.)?([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\);/g;
  let match;
  
  while ((match = createTableRegex.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    
    const columns = [];
    // Basic line-by-line parsing inside the CREATE TABLE block
    const lines = columnsBlock.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip constraints like PRIMARY KEY, FOREIGN KEY, UNIQUE
      if (trimmed === '' || trimmed.startsWith('CONSTRAINT') || trimmed.startsWith('PRIMARY KEY') || trimmed.startsWith('FOREIGN KEY') || trimmed.startsWith('UNIQUE')) {
        continue;
      }
      
      // Extract column name (first word, often quoted or unquoted)
      const colMatch = trimmed.match(/^"?[a-zA-Z0-9_]+"?(?=\s)/);
      if (colMatch) {
        let colName = colMatch[0].replace(/"/g, '');
        columns.push(colName);
      }
    }
    
    tables[tableName] = columns;
  }
  
  return tables;
}

function parseSchemaTs(tsContent) {
  const tables = {};
  
  // Regex to find pgTable definitions: pgTable("table_name", { ... })
  const pgTableRegex = /pgTable\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  let match;
  
  while ((match = pgTableRegex.exec(tsContent)) !== null) {
    const tableName = match[1];
    const columnsBlock = match[2];
    
    const columns = [];
    
    // Extract column definitions inside the block: camelCaseName: type("db_column_name")
    // E.g. id: uuid("id").primaryKey()
    const colRegex = /[a-zA-Z0-9_]+\s*:\s*[a-zA-Z0-9_]+\s*\(\s*['"]([a-zA-Z0-9_]+)['"]/g;
    let colMatch;
    
    while ((colMatch = colRegex.exec(columnsBlock)) !== null) {
      columns.push(colMatch[1]);
    }
    
    tables[tableName] = columns;
  }
  
  return tables;
}

try {
  console.log('📖 Reading files...');
  if (!fs.existsSync(sqlDumpPath)) throw new Error('SQL dump not found at ' + sqlDumpPath);
  if (!fs.existsSync(schemaTsPath)) throw new Error('schema.ts not found at ' + schemaTsPath);
  
  const sqlContent = fs.readFileSync(sqlDumpPath, 'utf8');
  const tsContent = fs.readFileSync(schemaTsPath, 'utf8');
  
  console.log('⚙️ Parsing SQL dump (34,000+ lines)...');
  const sqlTables = parseSqlDump(sqlContent);
  
  console.log('⚙️ Parsing Drizzle schema.ts...');
  const tsTables = parseSchemaTs(tsContent);
  
  console.log('⚖️ Performing Strict Gaps Analysis...');
  
  const missingInSchema = { tables: [], columns: {} };
  const missingInDb = { tables: [], columns: {} };
  
  // 1. Check what's in DB but missing/different in Schema
  for (const [dbTableName, dbCols] of Object.entries(sqlTables)) {
    if (!tsTables[dbTableName]) {
      missingInSchema.tables.push(dbTableName);
    } else {
      const schemaCols = tsTables[dbTableName];
      const missingCols = dbCols.filter(c => !schemaCols.includes(c));
      if (missingCols.length > 0) {
        missingInSchema.columns[dbTableName] = missingCols;
      }
    }
  }
  
  // 2. Check what's in Schema but missing/different in DB
  for (const [tsTableName, tsCols] of Object.entries(tsTables)) {
    if (!sqlTables[tsTableName]) {
      missingInDb.tables.push(tsTableName);
    } else {
      const dbCols = sqlTables[tsTableName];
      const missingCols = tsCols.filter(c => !dbCols.includes(c));
      if (missingCols.length > 0) {
        missingInDb.columns[tsTableName] = missingCols;
      }
    }
  }
  
  const report = {
    summary: {
      dbTotalTables: Object.keys(sqlTables).length,
      schemaTotalTables: Object.keys(tsTables).length,
    },
    missingInSchema,
    missingInDb,
    normalizationRecommendations: [
      "Ensure robust tenant_id indices for multi-tenant isolation.",
      "Separate attendance_logs from employee_profiles for 3NF compliance.",
      "Verify that all timestamp columns utilize 'withTimezone: true'."
    ]
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
  
  console.log(\`✅ Analysis Complete! Results saved to \${outputPath}\`);
  console.log(\`\nFound \${missingInSchema.tables.length} tables in DB missing from Drizzle Schema.\`);
  console.log(\`Found \${missingInDb.tables.length} tables in Drizzle Schema missing from DB.\`);
  
} catch (error) {
  console.error('❌ Error during analysis:', error);
}
