import psycopg2

db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("""
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id';
""")
tenant_tables = set(r[0] for r in cur.fetchall())

cur.execute("""
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
""")
all_tables = set(r[0] for r in cur.fetchall())

non_tenant = sorted(all_tables - tenant_tables)
print("Non-tenant tables in DB:")
for t in non_tenant:
    print(" ", t)
conn.close()
