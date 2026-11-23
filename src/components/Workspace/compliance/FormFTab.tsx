"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Eye, FileCheck, FileText, Plus, Printer, Trash2 } from "lucide-react";
import styles from "../ComplianceView.module.css";
import { NS, fieldErrors, formatNumber, todayIso, useResource, useSubmit, useT, type Problem } from "./api";
import FormFCertificate, { useFormFPrint } from "./FormFCertificate";
import type { FormFView, Nominee } from "./types";

/**
 * Form F gratuity nomination studio. Employee from GET /api/v1/people (search), particulars and nominees on
 * record from GET /api/v1/compliance/form-f, registration via POST /api/v1/compliance/form-f. Shares must
 * total exactly 100 % (same rule as the server, compared in hundredths).
 */

type Person = { id: string; employeeCode: string; firstName: string; lastName: string; department: string };
type Draft = { name: string; relationship: string; age: string; address: string; sharePercent: string; contingency: string };
const BLANK: Draft = { name: "", relationship: "", age: "", address: "", sharePercent: "", contingency: "" };

const hundredths = (drafts: Draft[]) => drafts.reduce((sum, d) => sum + Math.round((Number(d.sharePercent) || 0) * 100), 0);
const toNominee = (d: Draft): Nominee => ({
  name: d.name.trim(), relationship: d.relationship.trim(), age: Number(d.age), sharePercent: Number(d.sharePercent),
  ...(d.address.trim() ? { address: d.address.trim() } : {}), ...(d.contingency.trim() ? { contingency: d.contingency.trim() } : {}),
});
function draftInvalid(d: Draft): boolean {
  const age = Number(d.age);
  const share = Number(d.sharePercent);
  return d.name.trim().length < 2 || !d.relationship.trim() || d.age === "" || !Number.isInteger(age) || age < 0 || age > 120 || !(share > 0 && share <= 100);
}

export default function FormFTab({ notify }: { notify: (title: string, message: string, tone: "success" | "error") => void }) {
  const { t, locale } = useT();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [witnesses, setWitnesses] = useState(["", ""]);
  const [declarationDate, setDeclarationDate] = useState(todayIso());
  const [problem, setProblem] = useState<Problem | null>(null);
  const { submit, pending } = useSubmit();
  const print = useFormFPrint();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const people = useResource<Person[]>(`/api/v1/people?pageSize=25&search=${encodeURIComponent(debounced)}`, t(`${NS}.ff_people_failed`, "Employees could not be loaded."));
  const formF = useResource<FormFView>(employeeId ? `/api/v1/compliance/form-f?employeeId=${encodeURIComponent(employeeId)}` : null, t(`${NS}.ff_failed`, "The Form F record could not be loaded."));
  const view = formF.state.status === "ready" ? formF.state.data : null;

  // Start from the current registration when the selected employee has one.
  const [seenView, setSeenView] = useState<FormFView | null>(null);
  if (view && view !== seenView) {
    setSeenView(view);
    const reg = view.registration;
    setDrafts(reg ? reg.nominees.map((n) => ({ name: n.name, relationship: n.relationship, age: String(n.age), address: n.address ?? "", sharePercent: String(n.sharePercent), contingency: n.contingency ?? "" })) : []);
    setWitnesses(reg ? [reg.witnesses[0]?.name ?? "", reg.witnesses[1]?.name ?? ""] : ["", ""]);
    setProblem(null);
  }

  const total = hundredths(drafts);
  const valid = Boolean(view) && drafts.length > 0 && drafts.every((d) => !draftInvalid(d)) && total === 10000 && witnesses.every((w) => w.trim().length >= 2) && declarationDate <= todayIso();
  const errors = fieldErrors(problem);
  const update = (i: number, key: keyof Draft, value: string) => setDrafts((list) => list.map((d, j) => (j === i ? { ...d, [key]: value } : d)));

  const loadOnRecord = () => {
    if (!view) return;
    setDrafts(view.nomineesOnRecord.map((n) => ({ name: n.name, relationship: n.relationship, age: n.age === null ? "" : String(n.age), address: n.address ?? "", sharePercent: n.sharePercent === null ? "" : String(n.sharePercent), contingency: "" })));
  };

  const register = async () => {
    if (!valid || pending || !view) return;
    setProblem(null);
    const result = await submit<{ serial: string }>("/api/v1/compliance/form-f", {
      employeeId: view.employee.id, nominees: drafts.map(toNominee), witnesses: witnesses.map((name) => ({ name: name.trim() })), declarationDate,
    }, t(`${NS}.ff_register_failed`, "The nomination could not be registered."));
    if (!result.ok) {
      setProblem(result.problem);
      notify(t(`${NS}.ff_title`, "Form F nomination"), result.problem?.message ?? "", "error");
      return;
    }
    notify(t(`${NS}.ff_title`, "Form F nomination"), t(`${NS}.ff_registered`, "Nomination registered as {serial}.", { serial: result.data?.serial ?? "" }), "success");
    await formF.reload();
  };

  return (
    <div className={styles.simulatorSection}>
      <div className={styles.simNotice}>
        <FileCheck size={18} aria-hidden="true" />
        <div>
          <strong>{t(`${NS}.ff_notice_title`, "Payment of Gratuity Act, 1972 (Rule 6(1) Form F):")}</strong>{" "}
          {t(`${NS}.ff_notice_body`, "Registers the employee's gratuity nomination from the employee master. Nominee shares must add up to exactly 100%.")}
        </div>
      </div>

      <div className={styles.simGrid}>
        <div className={styles.inputCard}>
          <h3><FileText size={18} aria-hidden="true" /> {t(`${NS}.ff_setup`, "Gratuity nomination setup")}</h3>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{t(`${NS}.ff_search`, "Search employee")}</span>
              <input className={styles.input} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t(`${NS}.ff_search_placeholder`, "Name or employee code")} />
            </label>
            <label className={styles.field}>
              <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.ff_employee`, "Employee")}</span>
              <select className={styles.input} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} aria-required="true" disabled={people.state.status !== "ready"}>
                <option value="">{people.state.status === "loading" ? t(`${NS}.loading`, "Loading…") : t(`${NS}.ff_choose`, "Choose an employee")}</option>
                {people.state.status === "ready" && people.state.data.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeCode} · {p.department})</option>)}
              </select>
            </label>
          </div>
          {people.state.status === "error" && <p className={styles.errorNote} role="alert">{people.state.message}</p>}
          {people.state.status === "ready" && people.state.data.length === 0 && <p className={styles.stateNote}>{t(`${NS}.ff_no_people`, "No employee matches this search.")}</p>}
          {!employeeId && <p className={styles.stateNote}>{t(`${NS}.ff_pick`, "Choose an employee to prepare their Form F.")}</p>}
          {formF.state.status === "loading" && <p className={styles.stateNote}>{t(`${NS}.loading`, "Loading…")}</p>}
          {formF.state.status === "error" && <p className={styles.errorNote} role="alert">{formF.state.message}</p>}

          {view && (
            <>
              <div className={styles.rowBetween}>
                <span className={styles.fieldLabel}>{t(`${NS}.ff_nominee_table`, "Nominee declaration ({count})", { count: drafts.length })}</span>
                {total === 10000 && drafts.length > 0
                  ? <span className={styles.allocationValidBadge}><CheckCircle size={12} aria-hidden="true" />{t(`${NS}.ff_share_ok`, "100% allocation validated")}</span>
                  : <span className={styles.allocationInvalidBadge} role="status">{t(`${NS}.ff_share_bad`, "Total: {total}% (must be 100%)", { total: formatNumber(total / 100, locale, 2) })}</span>}
              </div>
              <div className={styles.toolbar}>
                <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={loadOnRecord} disabled={view.nomineesOnRecord.length === 0}
                  title={view.nomineesOnRecord.length === 0 ? t(`${NS}.ff_no_record`, "No dependant of this employee is marked as a gratuity nominee.") : undefined}>
                  {t(`${NS}.ff_load_record`, "Load nominees on record ({count})", { count: view.nomineesOnRecord.length })}
                </button>
                <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={() => setDrafts((list) => [...list, { ...BLANK }])} disabled={drafts.length >= 10}>
                  <Plus size={12} aria-hidden="true" />{t(`${NS}.ff_add_nominee`, "Add nominee")}
                </button>
              </div>
              {drafts.map((d, i) => (
                <fieldset key={i} className={styles.nomineeEditor} aria-invalid={draftInvalid(d) ? "true" : undefined}>
                  <legend className={styles.fieldLabel}>{t(`${NS}.ff_nominee_n`, "Nominee {n}", { n: i + 1 })}</legend>
                  <input className={styles.input} aria-label={t(`${NS}.ff_col_name`, "Name")} placeholder={t(`${NS}.ff_col_name`, "Name")} value={d.name} maxLength={160} onChange={(e) => update(i, "name", e.target.value)} aria-required="true" />
                  <input className={styles.input} aria-label={t(`${NS}.ff_col_relationship`, "Relationship")} placeholder={t(`${NS}.ff_col_relationship`, "Relationship")} value={d.relationship} maxLength={60} onChange={(e) => update(i, "relationship", e.target.value)} aria-required="true" />
                  <input className={styles.input} type="number" min={0} max={120} aria-label={t(`${NS}.ff_col_age`, "Age")} placeholder={t(`${NS}.ff_col_age`, "Age")} value={d.age} onChange={(e) => update(i, "age", e.target.value)} aria-required="true" />
                  <input className={styles.input} type="number" min={0.01} max={100} step="0.01" aria-label={t(`${NS}.ff_col_share`, "Share %")} placeholder={t(`${NS}.ff_col_share`, "Share %")} value={d.sharePercent} onChange={(e) => update(i, "sharePercent", e.target.value)} aria-required="true" />
                  <input className={styles.input} aria-label={t(`${NS}.ff_col_address`, "Address")} placeholder={t(`${NS}.ff_col_address`, "Address")} value={d.address} maxLength={500} onChange={(e) => update(i, "address", e.target.value)} />
                  <input className={styles.input} aria-label={t(`${NS}.ff_col_contingency`, "Contingency")} placeholder={t(`${NS}.ff_col_contingency`, "Contingency")} value={d.contingency} maxLength={300} onChange={(e) => update(i, "contingency", e.target.value)} />
                  <button type="button" className={`${styles.btnSecondary} ${styles.smallBtn}`} onClick={() => setDrafts((list) => list.filter((_, j) => j !== i))} aria-label={t(`${NS}.ff_remove_n`, "Remove nominee {n}", { n: i + 1 })}><Trash2 size={12} aria-hidden="true" /></button>
                </fieldset>
              ))}
              {errors.nominees && <p className={styles.fieldError}>{errors.nominees}</p>}
              <div className={styles.formGrid}>
                {[0, 1].map((i) => (
                  <label key={i} className={styles.field}>
                    <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.ff_witness_n`, "Witness {n}", { n: i + 1 })}</span>
                    <input className={styles.input} maxLength={160} value={witnesses[i]} onChange={(e) => setWitnesses((w) => w.map((v, j) => (j === i ? e.target.value : v)))} aria-required="true" />
                  </label>
                ))}
                <label className={styles.field}>
                  <span className={`${styles.fieldLabel} ${styles.required}`}>{t(`${NS}.ff_declared_on`, "Declaration date")}</span>
                  <input type="date" className={styles.input} value={declarationDate} max={todayIso()} onChange={(e) => setDeclarationDate(e.target.value)} aria-required="true" />
                </label>
              </div>
              {problem && <p className={styles.errorNote} role="alert">{problem.message}</p>}
              <div className={styles.actionsRow}>
                <button type="button" className={styles.btnSecondary} onClick={() => { if (!print(view)) notify(t(`${NS}.ff_title`, "Form F nomination"), t(`${NS}.ff_print_blocked`, "The print view could not be opened. Allow pop-ups and try again."), "error"); }}
                  disabled={!view.registration} title={view.registration ? undefined : t(`${NS}.ff_print_need_reg`, "Register the nomination first; the certificate prints from the registered record.")}>
                  <Printer size={14} aria-hidden="true" />{t(`${NS}.ff_print`, "Print statutory certificate")}
                </button>
                <button type="button" className={styles.btnPrimary} onClick={() => void register()} disabled={!valid || pending}>
                  <FileCheck size={14} aria-hidden="true" />{pending ? t(`${NS}.saving`, "Saving…") : t(`${NS}.ff_register`, "Register Form F nomination")}
                </button>
              </div>
            </>
          )}
        </div>

        <div className={styles.resultCard}>
          <h3><Eye size={18} aria-hidden="true" /> {t(`${NS}.ff_preview`, "Statutory Form F preview")}</h3>
          {view ? <FormFCertificate view={view} nominees={drafts.filter((d) => d.name.trim()).map(toNominee)} witnesses={witnesses} /> : <p className={styles.stateNote}>{t(`${NS}.ff_preview_empty`, "The preview appears once an employee is chosen.")}</p>}
        </div>
      </div>
    </div>
  );
}
