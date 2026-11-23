"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { getData, type Translate } from "./api";
import styles from "./EmployeePicker.module.css";

/**
 * Searchable employee picker over GET /api/v1/people?search=. The server applies the
 * caller's permissions and tenant scope; this control only shows what came back.
 */

export type EmployeeOption = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  department: string | null;
  status: string | null;
};

type PeopleRow = {
  id: string; employeeCode: string; firstName: string | null; lastName: string | null;
  designation: string | null; department: string | null; status: string | null;
};

const NS = "components.Workspace.EmployeePicker";
const INACTIVE = new Set(["exited", "inactive", "terminated", "resigned"]);

export function toEmployeeOption(row: PeopleRow): EmployeeOption {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    name: `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || row.employeeCode,
    designation: row.designation,
    department: row.department,
    status: row.status,
  };
}

type Props = {
  id?: string;
  label: string;
  value: EmployeeOption | null;
  onChange: (value: EmployeeOption | null) => void;
  required?: boolean;
  /** Employee ids that may not be picked (for example the record being edited). */
  excludeIds?: readonly string[];
  activeOnly?: boolean;
  error?: string;
  describedBy?: string;
  disabled?: boolean;
};

export default function EmployeePicker({ id, label, value, onChange, required, excludeIds = [], activeOnly = true, error, describedBy, disabled }: Props) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const autoId = useId();
  const inputId = id ?? `employee-picker-${autoId}`;
  const listId = `${inputId}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "error"; items: EmployeeOption[]; message?: string }>({ status: "idle", items: [] });
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const excludeKey = excludeIds.join("|");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setState((current) => ({ ...current, status: "loading" }));
      const url = `/api/v1/people?pageSize=20&search=${encodeURIComponent(query.trim())}`;
      getData<PeopleRow[]>(url, t(`${NS}.text_load_failed`, "Employees could not be loaded."), controller.signal)
        .then((rows) => {
          const excluded = new Set(excludeKey ? excludeKey.split("|") : []);
          const items = rows.map(toEmployeeOption).filter((item) => !excluded.has(item.id) && !(activeOnly && INACTIVE.has(String(item.status ?? "").toLowerCase())));
          setState({ status: "ready", items });
          setActive(0);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setState({ status: "error", items: [], message: err instanceof Error ? err.message : t(`${NS}.text_load_failed`, "Employees could not be loaded.") });
        });
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [open, query, excludeKey, activeOnly, t]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (option: EmployeeOption) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, Math.max(state.items.length - 1, 0))); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (event.key === "Enter" && open && state.items[active]) { event.preventDefault(); choose(state.items[active]); }
    else if (event.key === "Escape") setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label htmlFor={inputId} className={styles.label}>
        {label}{required ? <span className={styles.req} aria-hidden="true">*</span> : <span className={styles.optional}>{t(`${NS}.text_optional`, "Optional")}</span>}
      </label>
      {value ? (
        <div className={`${styles.chip} ${error ? styles.bad : ""}`}>
          <span className={styles.chipText}>
            <strong>{value.name}</strong>
            <span className={styles.meta}>{[value.employeeCode, value.designation, value.department].filter(Boolean).join(" · ")}</span>
          </span>
          {!disabled && (
            <button type="button" className={styles.clear} onClick={() => onChange(null)} aria-label={t(`${NS}.text_clear`, "Clear {label}", { label })}>
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <div className={`${styles.inputWrap} ${error ? styles.bad : ""}`}>
          <Search size={15} aria-hidden="true" className={styles.icon} />
          <input
            id={inputId}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            aria-activedescendant={open && state.items[active] ? `${listId}-${state.items[active].id}` : undefined}
            className={styles.input}
            value={query}
            disabled={disabled}
            placeholder={t(`${NS}.text_search`, "Search by name or employee code")}
            onFocus={() => setOpen(true)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onKeyDown={onKeyDown}
          />
        </div>
      )}
      {open && !value && (
        <ul id={listId} role="listbox" className={styles.list} aria-label={label}>
          {state.status === "loading" && <li className={styles.note}>{t(`${NS}.text_loading`, "Searching…")}</li>}
          {state.status === "error" && <li className={styles.note} role="alert">{state.message}</li>}
          {state.status === "ready" && state.items.length === 0 && <li className={styles.note}>{t(`${NS}.text_empty`, "No matching employee.")}</li>}
          {state.items.map((item, index) => (
            <li
              key={item.id}
              id={`${listId}-${item.id}`}
              role="option"
              aria-selected={index === active}
              className={`${styles.option} ${index === active ? styles.optionOn : ""}`}
              onMouseDown={(event) => { event.preventDefault(); choose(item); }}
              onMouseEnter={() => setActive(index)}
            >
              <strong>{item.name}</strong>
              <span className={styles.meta}>{[item.employeeCode, item.designation, item.department].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
