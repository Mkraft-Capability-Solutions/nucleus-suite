"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import styles from "../ContractWorkforceView.module.css";
import { NS, WORKER_CATEGORIES, errorText, getData, postData, type ContractOption, type Loadable, type LocationOption, type Translate, type WorkerCategory } from "./api";
import { categoryLabel, categoryRule } from "./labels";
import { validateWorker, type WorkerForm } from "./validation";

/**
 * Register contract worker: contracts from GET /api/v1/contractors/contracts, sites from GET /api/v1/organization/locations,
 * submit to POST /api/v1/contractors/assignments with one Idempotency-Key per submit (reused on retry, renewed on edit).
 */

type Options = { contracts: ContractOption[]; locations: LocationOption[] };
const today = () => new Date().toISOString().slice(0, 10);
const EMPTY: WorkerForm = { personName: "", agencyId: "", contractId: "", category: "contract", role: "", dailyWage: "", uan: "", esicNumber: "", aadhaar: "", locationId: "", startsOn: today() };

export default function RegisterWorkerDialog({ t, onClose, onRegistered }: { t: Translate; onClose: () => void; onRegistered: (name: string) => void }) {
  const [options, setOptions] = useState<Loadable<Options>>({ status: "loading" });
  const [form, setForm] = useState<WorkerForm>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof WorkerForm, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const keyRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = form !== EMPTY;

  useEffect(() => {
    const controller = new AbortController();
    const failed = t(`${NS}.text_options_failed`, "Contracts and work sites could not be loaded.");
    Promise.all([
      getData<ContractOption[]>("/api/v1/contractors/contracts", failed, controller.signal),
      getData<{ items: LocationOption[] }>("/api/v1/organization/locations", failed, controller.signal),
    ]).then(([contracts, locations]) => setOptions({ status: "ready", data: { contracts: contracts.data, locations: locations.data.items ?? [] } }))
      .catch((error: unknown) => { if (!controller.signal.aborted) setOptions({ status: "error", message: errorText(error, failed) }); });
    return () => controller.abort();
  }, [t]);

  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm(t(`${NS}.text_discard_confirm`, "Discard the details you entered?"))) return;
    onClose();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const agencies = useMemo(() => {
    if (options.status !== "ready") return [];
    const seen = new Map<string, string>();
    for (const c of options.data.contracts) if (!seen.has(c.agencyId)) seen.set(c.agencyId, c.agencyName ?? c.agencyId);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [options]);
  const contracts = options.status === "ready" ? options.data.contracts.filter((c) => c.agencyId === form.agencyId) : [];

  const set = <K extends keyof WorkerForm>(name: K, value: WorkerForm[K]) => {
    keyRef.current = null;
    setServerError(null);
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "agencyId") next.contractId = "";
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const found = validateWorker(t, form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) { formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
    keyRef.current ??= crypto.randomUUID();
    setBusy(true);
    const body = {
      contractId: form.contractId, personName: form.personName.trim(), category: form.category, role: form.role.trim(), dailyWage: Number(form.dailyWage),
      uan: form.uan.trim(), esicNumber: form.esicNumber.trim(), aadhaar: form.aadhaar.trim(), locationId: form.locationId, startsOn: form.startsOn,
    };
    const result = await postData<{ name?: string }>("/api/v1/contractors/assignments", body, keyRef.current, t(`${NS}.text_register_failed`, "The worker could not be registered. Try again."));
    setBusy(false);
    if (result.status === "error") {
      setServerError(result.message);
      setErrors(result.fields as Partial<Record<keyof WorkerForm, string>>);
      return;
    }
    onRegistered(form.personName.trim());
  };

  const field = (name: keyof WorkerForm, label: string, input: React.ReactNode, full = false) => (
    <div className={`${styles.formGroup} ${full ? styles.formFieldFull : ""}`}>
      <label htmlFor={`cw-${name}`}>{label}</label>
      {input}
      {errors[name] && <span id={`cw-${name}-err`} className={styles.fieldError}>{errors[name]}</span>}
    </div>
  );
  const aria = (name: keyof WorkerForm, required = false) => ({
    id: `cw-${name}`, name, "aria-invalid": Boolean(errors[name]), "aria-describedby": errors[name] ? `cw-${name}-err` : undefined, ...(required ? { "aria-required": true } : {}),
  });
  const req = (text: string) => `${text} *`;
  const opt = (text: string) => t(`${NS}.text_optional_label`, "{label} (optional)", { label: text });

  return (
    <div className={styles.modalOverlay} onClick={close}>
      <div className={styles.modalContainer} role="dialog" aria-modal="true" aria-labelledby="cw-register-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 id="cw-register-title">{t(`${NS}.text_register_contract_worker`, "Register Contract Worker")}</h3>
          <button type="button" className={styles.modalCloseBtn} onClick={close} disabled={busy} aria-label={t(`${NS}.text_close`, "Close")}><X size={18} /></button>
        </div>
        {options.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.text_options_loading`, "Loading contracts and work sites…")}</p>}
        {options.status === "error" && <p className={styles.stateError} role="alert">{options.message}</p>}
        {options.status === "ready" && (agencies.length === 0 || options.data.locations.length === 0) && (
          <p className={styles.stateError} role="alert">
            {agencies.length === 0
              ? t(`${NS}.text_no_contracts`, "No agency contract exists yet. Create the agency and its contract before registering workers.")
              : t(`${NS}.text_no_locations`, "No work site exists yet. Add a location in the organisation masters first.")}
          </p>
        )}
        {options.status === "ready" && agencies.length > 0 && options.data.locations.length > 0 && (
          <form ref={formRef} onSubmit={submit} noValidate>
            <div className={styles.formGrid}>
              {field("personName", req(t(`${NS}.text_worker_full_name_label`, "Worker full name")),
                <input type="text" maxLength={120} autoComplete="off" value={form.personName} onChange={(e) => set("personName", e.target.value)} {...aria("personName", true)} />, true)}
              {field("agencyId", req(t(`${NS}.text_contractor_agency_label`, "Contractor / agency")),
                <select value={form.agencyId} onChange={(e) => set("agencyId", e.target.value)} {...aria("agencyId", true)}>
                  <option value="">{t(`${NS}.text_choose`, "Choose…")}</option>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>)}
              {field("contractId", req(t(`${NS}.text_contract_label`, "Contract")),
                <select value={form.contractId} onChange={(e) => set("contractId", e.target.value)} disabled={!form.agencyId} {...aria("contractId", true)}>
                  <option value="">{form.agencyId ? t(`${NS}.text_choose`, "Choose…") : t(`${NS}.text_choose_agency_first`, "Choose the agency first")}</option>
                  {contracts.map((c) => <option key={c.id} value={c.id}>{[c.code ?? c.id.slice(0, 8), c.status, c.startsOn && c.endsOn ? `${c.startsOn} – ${c.endsOn}` : null].filter(Boolean).join(" · ")}</option>)}
                </select>)}
              {field("category", req(t(`${NS}.text_worker_category_label`, "Worker category & rest day rules")),
                <select value={form.category} onChange={(e) => set("category", e.target.value as WorkerCategory)} {...aria("category", true)}>
                  {WORKER_CATEGORIES.map((value) => <option key={value} value={value}>{categoryLabel(t, value)}</option>)}
                </select>)}
              <div className={styles.restDayBanner}><ShieldCheck size={16} aria-hidden="true" /><span>{categoryRule(t, form.category)}</span></div>
              {field("role", req(t(`${NS}.text_role_trade_label`, "Role / trade")),
                <input type="text" maxLength={80} value={form.role} onChange={(e) => set("role", e.target.value)} placeholder={t(`${NS}.placeholder_eg_loom_maintenance_specialist`, "e.g. Loom Maintenance Specialist")} {...aria("role", true)} />)}
              {field("dailyWage", req(t(`${NS}.text_daily_wage_label`, "Daily wage rate")),
                <input type="number" min="0.01" step="0.01" inputMode="decimal" value={form.dailyWage} onChange={(e) => set("dailyWage", e.target.value)} {...aria("dailyWage", true)} />)}
              {field("uan", opt(t(`${NS}.text_uan_12_digits`, "UAN (12 digits)")),
                <input type="text" inputMode="numeric" maxLength={12} value={form.uan} onChange={(e) => set("uan", e.target.value)} {...aria("uan")} />)}
              {field("esicNumber", opt(t(`${NS}.text_esic_number_label`, "ESIC number (10 to 17 digits)")),
                <input type="text" inputMode="numeric" maxLength={17} value={form.esicNumber} onChange={(e) => set("esicNumber", e.target.value)} {...aria("esicNumber")} />)}
              {field("aadhaar", opt(t(`${NS}.text_aadhaar_12_digits`, "Aadhaar (12 digits)")),
                <input type="text" inputMode="numeric" maxLength={12} autoComplete="off" value={form.aadhaar} onChange={(e) => set("aadhaar", e.target.value)} {...aria("aadhaar")} />)}
              {field("locationId", req(t(`${NS}.text_work_site_label`, "Work site / plant location")),
                <select value={form.locationId} onChange={(e) => set("locationId", e.target.value)} {...aria("locationId", true)}>
                  <option value="">{t(`${NS}.text_choose`, "Choose…")}</option>
                  {options.data.locations.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                </select>)}
              {field("startsOn", req(t(`${NS}.text_assignment_start_label`, "Assignment start date")),
                <input type="date" value={form.startsOn} onChange={(e) => set("startsOn", e.target.value)} {...aria("startsOn", true)} />)}
            </div>
            <p className={styles.formHint}>{t(`${NS}.text_aadhaar_note`, "Only the last four digits of Aadhaar are stored.")}</p>
            {serverError && <p className={styles.stateError} role="alert">{serverError}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={close} disabled={busy}>{t(`${NS}.text_cancel`, "Cancel")}</button>
              <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.text_registering`, "Registering…") : t(`${NS}.text_register_worker`, "Register worker")}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
