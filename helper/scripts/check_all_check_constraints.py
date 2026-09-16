import psycopg2

db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("""
    SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE contype = 'c'
    ORDER BY conrelid::regclass::text;
""")
for tbl, con, definition in cur.fetchall():
    if "ANY" in definition:
        print(f"{tbl} -> {con}: {definition}")
conn.close()
