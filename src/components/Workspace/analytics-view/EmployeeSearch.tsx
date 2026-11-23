"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "@/context/I18nContext";
import { getJson } from "@/lib/client-api";
import { NS } from "./AnalyticsParts";
import styles from "../AnalyticsView.module.css";

export type EmployeeOption = { id: string; label: string };
type PeopleRow = { id: string; employeeCode?: string; firstName?: string; lastName?: string; department?: string };

/** Searchable employee picker over GET /api/v1/people (server-side search, tenant scoped). */
export default function EmployeeSearch({ id, value, onChange, invalid, describedBy }: {
  id: string;
  value: EmployeeOption | null;
  onChange: (option: EmployeeOption | null) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setStatus("loading");
      getJson(`/api/v1/people?search=${encodeURIComponent(query.trim())}&page=1&pageSize=20`)
        .then((body) => {
          if (cancelled) return;
          const rows = ((body as { data?: PeopleRow[] })?.data ?? []);
          setOptions(rows.map((row) => ({
            id: row.id,
            label: [row.employeeCode, [row.firstName, row.lastName].filter(Boolean).join(" "), row.department].filter(Boolean).join(" · "),
          })));
          setStatus("idle");
        })
        .catch((caught: unknown) => {
          if (cancelled) return;
          setError(caught instanceof Error ? caught.message : "");
          setStatus("error");
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, open]);

  const listId = `${id}-options`;
  return (
    <div className={styles.picker}>
      <input id={id} className={styles.input} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-invalid={invalid} aria-describedby={describedBy} aria-required="true"
        value={value && !open ? value.label : query}
        placeholder={t(`${NS}.placeholder_search_employee`, "Search by name or employee code")}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQuery(e.target.value); onChange(null); setOpen(true); }} />
      {open && (
        <ul id={listId} role="listbox" className={styles.pickerList}>
          {status === "loading" && <li className={styles.rowSub}>{t(`${NS}.text_loading`, "Loading...")}</li>}
          {status === "error" && <li className={styles.fieldError}>{error || t(`${NS}.error_people_load`, "Employees could not be loaded.")}</li>}
          {status === "idle" && options.length === 0 && <li className={styles.rowSub}>{t(`${NS}.text_no_employee_match`, "No employee matches this search.")}</li>}
          {status === "idle" && options.map((option) => (
            <li key={option.id} role="option" aria-selected={value?.id === option.id}>
              <button type="button" className={styles.pickerOption} onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(option); setQuery(""); setOpen(false); }}>
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
