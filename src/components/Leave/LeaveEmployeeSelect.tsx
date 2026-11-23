"use client";

import { useEffect, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useLeaveResource, useLeaveT, type LeaveEmployee } from "./leave-client";

const NS = "components.Leave.LeaveEmployeeSelect";

/**
 * Searchable employee picker over GET /api/v1/leave/employees. The server
 * decides the scope: HR and approvers search the tenant, everyone else gets
 * only themselves. The selected employee is kept even when a new search
 * result no longer contains it.
 */
export default function LeaveEmployeeSelect({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  id,
  error,
}: {
  value: LeaveEmployee | null;
  onChange: (value: LeaveEmployee | null) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  error?: string;
}) {
  const { t } = useLeaveT();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(input.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [input]);
  const { state } = useLeaveResource<LeaveEmployee[]>(
    `/api/v1/leave/employees?search=${encodeURIComponent(search)}`,
    t(`${NS}.text_load_failed`, "Employees could not be loaded."),
  );
  const fetched = state.status === "ready" ? state.data : [];
  const options = value && !fetched.some((option) => option.id === value.id) ? [value, ...fetched] : fetched;
  const helper = error || (state.status === "error" ? state.message : undefined);
  return (
    <Autocomplete
      id={id}
      fullWidth
      disabled={disabled}
      options={options}
      value={value}
      loading={state.status === "loading"}
      loadingText={t(`${NS}.text_loading`, "Loading…")}
      noOptionsText={t(`${NS}.text_no_options`, "No matching employee")}
      getOptionKey={(option) => option.id}
      getOptionLabel={(option) => `${option.name} · ${option.employeeCode}`}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(items) => items}
      onInputChange={(_, next, reason) => {
        if (reason === "input" || reason === "clear") setInput(next);
      }}
      onChange={(_, option) => onChange(option)}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={t(`${NS}.placeholder_select_employee`, "Search employee by name or code")}
          required={required}
          error={Boolean(error) || state.status === "error"}
          helperText={helper}
        />
      )}
    />
  );
}
