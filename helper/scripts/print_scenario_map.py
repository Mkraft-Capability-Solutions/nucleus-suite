import openpyxl
import json

file_path = r"C:\Users\singh\Downloads\Nucleus_HRMS_Demo_Dataset_v1.0.xlsx"
wb = openpyxl.load_workbook(file_path, data_only=True)

scenario_sheet = wb["01_Scenario_Map"]
print("=== 01_Scenario_Map ===")
for r in scenario_sheet.iter_rows(values_only=True):
    row_vals = [str(c) for c in r if c is not None and str(c).strip()]
    if row_vals:
        print(" | ".join(row_vals))
