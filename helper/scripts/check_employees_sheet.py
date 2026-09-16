import openpyxl

file_path = r"C:\Users\singh\Downloads\Nucleus_HRMS_Demo_Dataset_v1.0.xlsx"
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb["12_Employees"]

rows = list(sheet.iter_rows(values_only=True))
headers = [str(c) if c is not None else "" for c in rows[0]]
print("Headers:", headers)
print(f"Total employee rows: {len(rows)-1}")

codes = []
names = []
for r in rows[1:]:
    if r[0]:
        codes.append(str(r[0]))
        names.append(str(r[1]))

print(f"Loaded {len(codes)} employees: from {codes[0]} ({names[0]}) to {codes[-1]} ({names[-1]})")
