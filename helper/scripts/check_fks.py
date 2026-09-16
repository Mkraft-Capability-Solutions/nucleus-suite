import psycopg2

db_url = None
with open(".env.local") as f:
    for line in f:
        if line.startswith("MIGRATION_DATABASE_URL="):
            db_url = line.split("=", 1)[1].strip().strip('"').strip("'")

conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute("""
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('attendance_punches', 'overtime_entries', 'attendance_days');
""")
for r in cur.fetchall():
    print(r)
conn.close()
