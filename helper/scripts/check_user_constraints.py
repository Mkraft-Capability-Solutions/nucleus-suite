import psycopg2

db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("""
    SELECT conname, pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'employees'::regclass AND contype = 'c';
""")
for r in cur.fetchall():
    print(r)
conn.close()
