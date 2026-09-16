import psycopg2

db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

conn = psycopg2.connect(db_url)
cur = conn.cursor()
for tbl in ['document_types', 'memberships']:
    cur.execute(f"""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = '{tbl}';
    """)
    print(f"\n{tbl} columns:")
    for r in cur.fetchall():
        print(" ", r)
conn.close()
