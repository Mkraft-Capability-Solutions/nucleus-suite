"use client";

import { useTranslation } from '@/context/I18nContext';
import { Autocomplete, TextField } from "@mui/material";
import type { LeaveEmployee } from "@/app/actions/leaveActions";
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
  const { t } = useTranslation();
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
        <TextField {...params} label={label} placeholder={t("components.Leave.LeaveEmployeeSelect.placeholder_select_employee", "Select Employee")} required={required} />
      )}
    />
  );
}
