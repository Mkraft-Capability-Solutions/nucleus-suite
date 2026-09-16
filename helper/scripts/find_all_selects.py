with open("scripts/seeder/load-excel-dataset.ts", "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    if "SELECT " in line:
        print(f"{idx}: {line.strip()}")
