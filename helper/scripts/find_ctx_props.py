import re

with open("scripts/seeder/load-excel-dataset.ts", "r", encoding="utf-8") as f:
    code = f.read()

matches = re.findall(r"\$\{ctx\.([a-zA-Z0-9_]+)\}", code)
print("Unique ctx properties referenced in SQL template strings:")
for m in sorted(set(matches)):
    print(" -", m)
