"use client";

import { useRef, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import styles from "../OnboardingView.module.css";
import { newIdempotencyKey, sendJson, type Translate } from "./api";
import EmployeePicker, { type EmployeeOption } from "./EmployeePicker";
import StateNote from "./StateNote";
import { useResource } from "./useResource";
import { printLetter } from "./printLetter";

/**
 * HR letter studio. The letter is generated and stored by POST /api/v1/hr-letters/generate
 * (hr_letters, audited); the preview shows the text the server returned, never a client
 * draft. Issued letters come from GET /api/v1/hr-letters; the letterhead names the tenant's
 * legal entity from GET /api/v1/organization/legal-entities.
 */

const NS = "components.Workspace.OnboardingView";

type LetterType = "appointment" | "confirmation" | "increment" | "promotion" | "relieving" | "experience" | "transfer";
type CustomField = { key: string; labelKey: string; fallback: string; type: "text" | "number" | "date" };

/** `promotion` has no server template (generateLetterSchema); it stays visible but disabled. */
const TEMPLATES: Array<{ value: LetterType; labelKey: string; fallback: string; supported: boolean; fields: CustomField[] }> = [
  { value: "appointment", labelKey: "letter_appointment", fallback: "Appointment letter", supported: true, fields: [] },
  { value: "confirmation", labelKey: "letter_confirmation", fallback: "Confirmation letter", supported: true, fields: [] },
  { value: "increment", labelKey: "letter_increment", fallback: "Increment letter", supported: true, fields: [
    { key: "hike_percentage", labelKey: "field_hike", fallback: "Increment (%)", type: "number" },
    { key: "performance_band", labelKey: "field_band", fallback: "Performance band", type: "text" },
    { key: "revised_ctc", labelKey: "field_revised_ctc", fallback: "Revised annual CTC", type: "number" },
  ] },
  { value: "promotion", labelKey: "letter_promotion", fallback: "Promotion letter", supported: false, fields: [
    { key: "promoted_designation", labelKey: "field_new_designation", fallback: "New designation", type: "text" },
    { key: "new_band", labelKey: "field_new_band", fallback: "New band", type: "text" },
  ] },
  { value: "relieving", labelKey: "letter_relieving", fallback: "Relieving letter", supported: true, fields: [
    { key: "relieving_date", labelKey: "field_relieving_date", fallback: "Relieving date", type: "date" },
  ] },
  { value: "experience", labelKey: "letter_experience", fallback: "Experience letter", supported: true, fields: [] },
  { value: "transfer", labelKey: "letter_transfer", fallback: "Transfer letter", supported: true, fields: [] },
];

type Generated = { id: string; letterType: string; content: string; employeeName: string };
type IssuedRow = { id: string; letter_type: string; generated_at: string; first_name: string; last_name: string; employee_code: string };
type EntityRow = { code: string; legal_name: string };

export default function LettersTab({ formatDateTime }: { formatDateTime: (iso: string | null) => string }) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = useHRMS() as { showToast?: (title: string, message: string, tone: string) => void };
  const issued = useResource<IssuedRow[]>("/api/v1/hr-letters?pageSize=10", t(`${NS}.letters_load_failed`, "Issued letters could not be loaded."));
  const entities = useResource<{ items: EntityRow[] }>("/api/v1/organization/legal-entities", t(`${NS}.entity_load_failed`, "The legal entity could not be loaded."));
  const [type, setType] = useState<LetterType>("appointment");
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string | null>(null);

  const template = TEMPLATES.find((item) => item.value === type) ?? TEMPLATES[0];
  const entity = entities.state.status === "ready" ? entities.state.data.items[0] ?? null : null;
  const label = (item: { labelKey: string; fallback: string }) => t(`${NS}.${item.labelKey}`, item.fallback);

  const changeInputs = (update: () => void) => { update(); keyRef.current = null; setGenerated(null); setError(null); };

  const generate = async () => {
    if (busy) return;
    if (!employee) { setError(t(`${NS}.err_pick_employee`, "Choose the employee the letter is for.")); return; }
    if (!template.supported) return;
    keyRef.current ??= newIdempotencyKey();
    setBusy(true);
    setError(null);
    const attributes = Object.fromEntries(template.fields.flatMap((field) => (custom[field.key]?.trim() ? [[field.key, custom[field.key].trim()]] : [])));
    const result = await sendJson<Generated>("/api/v1/hr-letters/generate", {
      method: "POST", body: { employeeId: employee.id, letterType: type, attributes }, idempotencyKey: keyRef.current,
      fallback: t(`${NS}.err_generate_failed`, "The letter could not be generated."),
    });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    keyRef.current = null;
    setGenerated(result.data);
    issued.reload();
    showToast?.(t(`${NS}.toast_letter_title`, "Letter generated"), t(`${NS}.toast_letter_body`, "{letter} for {name} is stored in the letter register.", { letter: label(template), name: result.data.employeeName }), "success");
  };

  const print = (asPdf: boolean) => {
    if (!generated) return;
    printLetter({
      title: `${label(template)} · ${generated.employeeName}`,
      entityName: entity?.legal_name ?? "",
      reference: generated.id,
      content: generated.content,
      hint: asPdf ? t(`${NS}.print_pdf_hint`, "Choose \"Save as PDF\" as the destination to export this letter.") : "",
    });
  };

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.cardAccent}`}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}><FileText size={20} aria-hidden="true" />{t(`${NS}.letters_title`, "HR letter studio")}</h3>
            <p className={styles.cardSub}>{t(`${NS}.letters_subtitle`, "Generate appointment, increment, relieving and other letters from the employee record. Every letter is stored and audited.")}</p>
          </div>
          <div className={styles.row}>
            <button type="button" className={styles.btnSecondary} onClick={() => print(false)} disabled={!generated}><Printer size={14} aria-hidden="true" />{t(`${NS}.print`, "Print")}</button>
            <button type="button" className={styles.btnPrimary} onClick={() => print(true)} disabled={!generated}><Download size={14} aria-hidden="true" />{t(`${NS}.export_pdf`, "Export PDF")}</button>
          </div>
        </div>
      </section>

      <div className={styles.letterStudioGrid}>
        <section className={styles.card} aria-labelledby="letter-config-title">
          <h4 id="letter-config-title" className={styles.cardTitleSm}>{t(`${NS}.letters_config`, "Letter details")}</h4>
          <div className={styles.stack} style={{ marginBlockStart: 14 }}>
            <div className={styles.formGroup}>
              <label htmlFor="letter-template">{t(`${NS}.field_template`, "Template")}<span className={styles.req} aria-hidden="true">*</span></label>
              <select id="letter-template" className={styles.formInput} value={type} onChange={(event) => changeInputs(() => setType(event.target.value as LetterType))}>
                {TEMPLATES.map((item) => <option key={item.value} value={item.value} disabled={!item.supported}>{label(item)}{item.supported ? "" : ` · ${t(`${NS}.letter_unsupported_short`, "not available")}`}</option>)}
              </select>
            </div>
            <EmployeePicker id="letter-employee" label={t(`${NS}.field_employee`, "Employee")} required value={employee} onChange={(value) => changeInputs(() => setEmployee(value))} />
            {template.fields.map((field) => (
              <div key={field.key} className={styles.formGroup}>
                <label htmlFor={`letter-${field.key}`}>{label(field)} <span className={styles.muted}>{t(`${NS}.hint_optional`, "Optional")}</span></label>
                <input id={`letter-${field.key}`} type={field.type} className={styles.formInput} value={custom[field.key] ?? ""} min={field.type === "number" ? 0 : undefined} onChange={(event) => changeInputs(() => setCustom((current) => ({ ...current, [field.key]: event.target.value })))} />
              </div>
            ))}
            {!template.supported && <p className={styles.unavailable}>{t(`${NS}.letter_unsupported`, "The letter service has no promotion template yet, so this letter cannot be generated.")}</p>}
            {error && <p className={styles.formError} role="alert">{error}</p>}
            <button type="button" className={styles.btnPrimary} onClick={() => void generate()} disabled={busy || !template.supported}>
              {busy ? t(`${NS}.generating`, "Generating…") : t(`${NS}.generate`, "Generate letter")}
            </button>
          </div>
        </section>

        <section className={styles.stack} aria-live="polite" aria-labelledby="letter-preview-title">
          <div className={styles.cardHead}>
            <strong id="letter-preview-title">{t(`${NS}.letters_preview`, "Letter preview")}</strong>
            {generated && <span className={`${styles.badge} ${styles.badgeSuccess}`}>{t(`${NS}.letters_stored`, "Stored")}</span>}
          </div>
          <div className={styles.letterPreviewCard}>
            <div className={styles.letterHead}>
              <div>
                <div className={styles.letterBrand}>{entity?.legal_name ?? (entities.state.status === "loading" ? "…" : t(`${NS}.entity_missing`, "No legal entity configured"))}</div>
                {entity && <div className={styles.muted}>{entity.code}</div>}
              </div>
              {generated && <div className={styles.muted}>{t(`${NS}.letter_reference`, "Reference {id}", { id: generated.id.slice(0, 8).toUpperCase() })}</div>}
            </div>
            {generated
              ? <pre className={styles.letterText}>{generated.content}</pre>
              : <p className={styles.muted}>{t(`${NS}.letters_preview_empty`, "Choose a template and an employee, then generate. The server-rendered letter appears here.")}</p>}
          </div>
        </section>
      </div>

      <section className={styles.card} aria-labelledby="letters-issued-title">
        <h4 id="letters-issued-title" className={styles.cardTitleSm}>{t(`${NS}.letters_issued`, "Recently generated letters")}</h4>
        {issued.state.status === "loading" && <StateNote tone="loading">{t(`${NS}.loading`, "Loading…")}</StateNote>}
        {issued.state.status === "error" && <StateNote tone="error" onRetry={issued.reload} retryLabel={t(`${NS}.retry`, "Try again")}>{issued.state.message}</StateNote>}
        {issued.state.status === "ready" && issued.state.data.length === 0 && <StateNote tone="empty">{t(`${NS}.letters_none`, "No letters have been generated yet.")}</StateNote>}
        {issued.state.status === "ready" && issued.state.data.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th scope="col">{t(`${NS}.col_employee`, "Employee")}</th>
                <th scope="col">{t(`${NS}.col_letter`, "Letter")}</th>
                <th scope="col">{t(`${NS}.col_generated`, "Generated")}</th>
              </tr></thead>
              <tbody>
                {issued.state.data.map((row) => {
                  const kind = TEMPLATES.find((item) => item.value === row.letter_type);
                  return (
                    <tr key={row.id}>
                      <td><strong>{`${row.first_name} ${row.last_name}`.trim()}</strong><div className={styles.muted}>{row.employee_code}</div></td>
                      <td>{kind ? label(kind) : row.letter_type}</td>
                      <td>{formatDateTime(row.generated_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
