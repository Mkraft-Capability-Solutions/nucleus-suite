import glob
import os
import re
import psycopg2

# Read MIGRATION_DATABASE_URL from .env.local
db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
            break

if not db_url:
    with open(".env") as f:
        for line in f:
            if line.startswith("MIGRATION_DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip().strip('"').strip("'")
                break

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT table_name, column_name, is_nullable, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
""")
db_columns = {}
for t, c, nullable, dtype, default_val in cur.fetchall():
    if t not in db_columns:
        db_columns[t] = {}
    db_columns[t][c] = {
        "nullable": nullable == "YES",
        "data_type": dtype,
        "default": default_val
    }

ts_files = glob.glob("scripts/seeder/*.ts")
all_errors = {}

for ts_file in sorted(ts_files):
    with open(ts_file, "r", encoding="utf-8") as f:
        code = f.read()

    # Find all INSERT INTO statements
    inserts = re.findall(r"INSERT INTO\s+([\"']?[a-zA-Z0-9_]+[\"']?)\s*\(([^)]+)\)", code, re.IGNORECASE | re.DOTALL)
    if not inserts:
        continue

    file_errors = []
    for table, cols in inserts:
        table = table.strip('"').strip("'")
        col_list = [re.sub(r'["\s]', '', c) for c in cols.split(",") if c.strip()]
        if table not in db_columns:
            file_errors.append(f"Table '{table}' does not exist in DB!")
            continue

        actual_cols = db_columns[table]
        for c in col_list:
            if c not in actual_cols:
                file_errors.append(f"Table '{table}' DOES NOT HAVE COLUMN '{c}'! Actual: {list(actual_cols.keys())}")

        # Check for required NOT NULL columns without default
        for c, meta in actual_cols.items():
            if not meta["nullable"] and c not in ["record_status", "version", "created_at", "updated_at"] and c not in col_list:
                if meta["default"] is None:
                    file_errors.append(f"Table '{table}' MISSING REQUIRED NOT NULL COLUMN '{c}' without default!")

    if file_errors:
        all_errors[ts_file] = file_errors

if all_errors:
    print(f"SCHEMA MISMATCH ERRORS FOUND IN {len(all_errors)} FILES:")
    for fpath, errs in all_errors.items():
        print(f"\n>>> {fpath} ({len(errs)} errors):")
        unique_errs = list(dict.fromkeys(errs))
        for e in unique_errs:
            print("  -", e)
else:
    print("ALL INSERT STATEMENTS ACROSS ALL SEEDER FILES MATCH THE DATABASE SCHEMA!")

conn.close()

