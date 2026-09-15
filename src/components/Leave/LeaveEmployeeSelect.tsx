"use client";
import { Autocomplete, TextField } from "@mui/material";
import type { LeaveEmployee } from "@/services/leave-reference";
export default function LeaveEmployeeSelect({
  options,
  value,
  onChange,
  label,
  required = false,
}: {
  options: LeaveEmployee[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
}) {
  return (
    <Autocomplete
      fullWidth
      options={options}
      value={options.find((option) => option.employeeId === value) ?? null}
      getOptionKey={(option) => option.employeeId}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(a, b) => a.employeeId === b.employeeId}
      onChange={(_, option) => onChange(option?.employeeId ?? "")}
      filterOptions={(items, { inputValue }) =>
        items.filter((item) =>
          `${item.employeeId} ${item.name}`
            .toLowerCase()
            .includes(inputValue.toLowerCase()),
        )
      }
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="Select Employee" required={required} />
      )}
    />
  );
}
