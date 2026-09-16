import glob
import re
import psycopg2

db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

cur.execute("""
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
""")
db_columns = {}
for t, c in cur.fetchall():
    if t not in db_columns:
        db_columns[t] = set()
    db_columns[t].add(c)

ts_files = glob.glob("scripts/seeder/*.ts")
for ts_file in sorted(ts_files):
    with open(ts_file, "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    for idx, line in enumerate(lines, 1):
        m = re.search(r"SELECT\s+(.*?)\s+FROM\s+([\"']?[a-zA-Z0-9_]+[\"']?)", line, re.IGNORECASE)
        if m:
            cols_str = m.group(1).strip()
            tbl = m.group(2).strip().strip('"').strip("'")
            if tbl in db_columns:
                # parse cols
                cols = [c.strip().split()[-1] for c in cols_str.split(",") if "count(" not in c.lower()]
                for c in cols:
                    c_clean = c.strip('"').strip("'")
                    if "->" in c_clean or "*" in c_clean or "::" in c_clean or "distinct" in c_clean.lower():
                        continue
                    if c_clean and c_clean not in db_columns[tbl]:
                        print(f"[{ts_file}:{idx}] Table '{tbl}' does NOT have column '{c_clean}'! Columns: {sorted(list(db_columns[tbl]))}")

conn.close()
