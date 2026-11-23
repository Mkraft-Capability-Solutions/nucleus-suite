"use client";

import { useRef, useState } from "react";
import Autocomplete from "@mui/material/Autocomplete";
import IconButton from "@mui/material/IconButton";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { fetchLookup, NS, type LookupState, type Option, type ResolvedField, type Translate } from "./data";
import styles from "../OperationalModuleView.module.css";

type Props = {
  field: ResolvedField;
  id: string;
  value: unknown;
  error?: string;
  lookup?: LookupState;
  t: Translate;
  onChange: (value: unknown) => void;
};

const text = (value: unknown) => (value === undefined || value === null ? "" : String(value));

/** Searchable picker over configured options or a master list; master lists search the server as the user types. */
function SearchableSelect({ field, id, value, error, lookup, t, onChange }: Props) {
  const [remote, setRemote] = useState<Option[] | null>(null);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const base = field.choices;
  const options = remote ?? base;
  const current = text(value);
  const selected = options.find((option) => option.value === current) ?? base.find((option) => option.value === current) ?? (current ? { value: current, label: current } : null);
  const unavailable = lookup?.status === "error";
  const errorId = `${id}-error`;

  const search = (input: string) => {
    if (!field.lookup) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      controller.current?.abort();
      const next = new AbortController();
      controller.current = next;
      setSearching(true);
      fetchLookup(field.lookup as NonNullable<ResolvedField["lookup"]>, input, next.signal, t(`${NS}.text_lookup_failed`, "This list could not be loaded."))
        .then((found) => setRemote(found))
        .catch(() => { if (!next.signal.aborted) setRemote(null); })
        .finally(() => { if (!next.signal.aborted) setSearching(false); });
    }, 250);
  };

  return (
    <>
      <Autocomplete
        id={id}
        options={options}
        value={selected}
        loading={lookup?.status === "loading" || searching}
        disabled={unavailable}
        isOptionEqualToValue={(option, chosen) => option.value === chosen.value}
        getOptionLabel={(option) => option.label}
        filterOptions={field.lookup ? (items) => items : undefined}
        onInputChange={(_, input, reason) => { if (reason === "input") search(input); }}
        onChange={(_, option) => onChange(option?.value ?? "")}
        noOptionsText={t(`${NS}.text_no_options`, "No matching entries")}
        loadingText={t(`${NS}.text_loading_options`, "Loading…")}
        slotProps={{ popper: { disablePortal: false } }}
        renderInput={(params) => (
          <div ref={params.InputProps.ref} className={styles.comboInput}>
            <input
              {...params.inputProps}
              name={field.key}
              required={field.required}
              aria-required={field.required}
              aria-invalid={Boolean(error)}
              aria-describedby={error || unavailable ? errorId : undefined}
              placeholder={t(`${NS}.placeholder_select`, "Search {label}", { label: field.label })}
            />
          </div>
        )}
      />
      {unavailable && !error && <span id={errorId} className={styles.fieldHint}>{lookup.message}</span>}
    </>
  );
}

/** One form control chosen by field type (registry field definition). */
export default function RecordField(props: Props) {
  const { field, id, value, error, t, onChange } = props;
  const errorId = `${id}-error`;
  const common = {
    id,
    name: field.key,
    required: field.required,
    "aria-required": field.required,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
  };
  const isSelect = field.lookup !== null || field.choices.length > 0;
  const numeric = Number(value);
  const min = field.min ?? 0;
  const step = field.step ?? 1;

  let control;
  if (field.type === "file") {
    control = (
      <>
        <input {...common} type="file" onChange={(event) => onChange(event.target.files?.[0]?.name ?? "")} />
        <span className={styles.fieldHint}>{t(`${NS}.text_file_name_only`, "Only the file name is recorded here. Store the document itself in the Document Vault.")}</span>
      </>
    );
  } else if (field.type === "checkbox") {
    control = <input {...common} type="checkbox" className={styles.checkbox} checked={value === true} onChange={(event) => onChange(event.target.checked)} />;
  } else if (isSelect) {
    control = <SearchableSelect {...props} />;
  } else if (field.derive?.kind === "inclusiveDays") {
    control = (
      <span className={styles.stepControl}>
        <IconButton type="button" aria-label={t(`${NS}.aria-label_decrease_days`, "Decrease days")} disabled={!Number.isFinite(numeric) || numeric <= min} onClick={() => onChange(Math.max(min, numeric - step))}><RemoveIcon /></IconButton>
        <input {...common} type="number" min={field.min} max={field.max} step={field.step} value={text(value)} onChange={(event) => onChange(event.target.value)} />
        <IconButton type="button" aria-label={t(`${NS}.aria-label_increase_days`, "Increase days")} disabled={field.max !== undefined && numeric >= field.max} onClick={() => onChange(Math.min(field.max ?? Number.MAX_SAFE_INTEGER, (Number.isFinite(numeric) ? numeric : 0) + step))}><AddIcon /></IconButton>
      </span>
    );
  } else if (field.type === "textarea") {
    control = <textarea {...common} rows={3} value={text(value)} onChange={(event) => onChange(event.target.value)} />;
  } else {
    const type = field.type === "time" || /time/i.test(field.control ?? "") ? "time" : field.type || "text";
    control = <input {...common} type={type} min={field.min} max={field.max} step={field.step} value={text(value)} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <label htmlFor={id}>
      <span>
        {field.label}
        {field.required ? <b aria-hidden> *</b> : <em className={styles.optional}>{t(`${NS}.text_optional`, "(optional)")}</em>}
      </span>
      {control}
      {error && <span id={errorId} role="alert" className={styles.fieldError}>{error}</span>}
    </label>
  );
}
