"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { GitBranch, History, Plus } from "lucide-react";
import {
  COMPANY_KIND_LABELS, durationLabel, MOVEMENT_LABELS, RECORDABLE_MOVES,
  type CareerEntry, type CareerStint, type CareerTreeNode, type CareerView, type Company, type MovementType,
} from "@/lib/career";
import styles from "./CareerHistory.module.css";

export type CareerPayload = {
  employee: { id: string; employeeCode: string; name: string; designation: string | null; status: string | null; exitedOn: string | null };
  entries: CareerEntry[];
  companies: Company[];
  view: CareerView;
  today: string;
  canRecord: boolean;
};

type Load = { state: "loading" } | { state: "missing"; message: string } | { state: "error"; message: string } | { state: "ready"; data: CareerPayload };

const PALETTE = ["#6d5dfc", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDay(date: string | null | undefined): string {
  if (!date) return "";
  const [year, month, day] = date.slice(0, 10).split("-");
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function stintPeriod(stint: Pick<CareerStint, "effectiveFrom" | "endsOn" | "current" | "months">): string {
  return `${formatDay(stint.effectiveFrom)} – ${stint.current ? "present" : formatDay(stint.endsOn)} · ${durationLabel(stint.months)}`;
}

/** Fetches the career of one employee (database id or employee code). */
export async function fetchCareer(employeeRef: string): Promise<{ ok: true; data: CareerPayload } | { ok: false; status: number; message: string }> {
  const response = await fetch(`/api/v1/career-history/${encodeURIComponent(employeeRef)}`, { cache: "no-store", credentials: "same-origin" }).catch(() => null);
  if (!response) return { ok: false, status: 0, message: "The career history could not be loaded. Check your connection and try again." };
  const body = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, message: body?.error?.message ?? "The career history could not be loaded." };
  return { ok: true, data: body.data as CareerPayload };
}

type FormState = { mode: "move" } | { mode: "correct"; entry: CareerStint };

export default function CareerHistory({ employeeRef }: { employeeRef: string | null }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [layout, setLayout] = useState<"timeline" | "tree">("timeline");
  const [form, setForm] = useState<FormState | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!employeeRef) return;
    let active = true;
    fetchCareer(employeeRef).then((result) => {
      if (!active) return;
      if ("data" in result) setLoad({ state: "ready", data: result.data });
      else if (result.status === 404) setLoad({ state: "missing", message: result.message });
      else setLoad({ state: "error", message: result.message });
    });
    return () => { active = false; };
  }, [employeeRef, version]);

  const colours = useMemo(() => {
    const map = new Map<string, string>();
    if (load.state !== "ready") return map;
    for (const stint of load.data.view.stints) {
      const key = stint.companyId ?? stint.companyName ?? "none";
      if (!map.has(key)) map.set(key, PALETTE[map.size % PALETTE.length]!);
    }
    return map;
  }, [load]);

  const reload = useCallback(() => { setForm(null); setVersion((value) => value + 1); }, []);

  if (!employeeRef) return <p className={styles.notice}>This employee has not been saved to the organisation&apos;s records yet, so there is no history to show.</p>;
  if (load.state === "loading") return <p className={styles.notice} role="status">Loading career history…</p>;
  if (load.state === "missing") return <p className={styles.notice}>This employee has not been saved to the organisation&apos;s records yet, so there is no history to show.</p>;
  if (load.state === "error") return <div className={styles.alert} role="alert">{load.message}</div>;

  const { data } = load;
  const { view } = data;
  const colourOf = (stint: { companyId: string | null; companyName: string | null }) => colours.get(stint.companyId ?? stint.companyName ?? "none") ?? PALETTE[0]!;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label="Career history layout">
          <button type="button" aria-pressed={layout === "timeline"} onClick={() => setLayout("timeline")}><History size={14} /> Timeline</button>
          <button type="button" aria-pressed={layout === "tree"} onClick={() => setLayout("tree")}><GitBranch size={14} /> Tree</button>
        </div>
        {data.canRecord && !data.employee.exitedOn && (
          <button type="button" className={styles.primary} onClick={() => setForm({ mode: "move" })}><Plus size={14} /> Record a move</button>
        )}
      </div>

      {form && <MoveForm data={data} form={form} onCancel={() => setForm(null)} onSaved={reload} />}

      {view.stints.length === 0 ? (
        <p className={styles.notice}>No job history has been recorded for this employee.</p>
      ) : (
        <>
          <div className={styles.totals}>
            <div className={styles.total}><span>{data.employee.exitedOn ? "Time in the group" : "In the group for"}</span><strong>{durationLabel(view.totals.months)}</strong></div>
            <div className={styles.total}><span>Companies</span><strong>{view.totals.companies}</strong></div>
            <div className={styles.total}><span>Positions</span><strong>{view.totals.positions}</strong></div>
            <div className={styles.total}><span>Promotions</span><strong>{view.totals.promotions}</strong></div>
          </div>
          {layout === "timeline" ? (
            <ol className={styles.timeline} aria-label="Career timeline, most recent first">
              {data.employee.exitedOn && <li className={styles.event}><span className={styles.dot} style={{ "--dot": "#94a3b8" } as CSSProperties} /><p className={styles.exit}>Left the group on {formatDay(data.employee.exitedOn)}</p></li>}
              {[...view.stints].reverse().map((stint) => (
                <li key={stint.id} className={styles.event}>
                  <span className={styles.dot} style={{ "--dot": colourOf(stint) } as CSSProperties} aria-hidden="true" />
                  <div className={styles.eventHead}>
                    <h4 className={styles.eventTitle}>{stint.designation ?? "Designation not recorded"}{stint.grade ? ` · ${stint.grade}` : ""}</h4>
                    <span className={styles.when}>{stintPeriod(stint)}</span>
                  </div>
                  <div className={styles.path}>{(stint.companyPath.length ? stint.companyPath : ["Company not recorded"]).map((name, index) => <span key={`${name}-${index}`}>{name}</span>)}</div>
                  <div className={styles.meta}>{[stint.department, stint.location, stint.managerName ? `Reports to ${stint.managerName}` : null].filter(Boolean).join(" · ") || "No department or location recorded"}</div>
                  <div className={styles.badges}>
                    <span className={`${styles.badge} ${styles.badgeMove}`}>{MOVEMENT_LABELS[stint.movementType]}</span>
                    {stint.current && <span className={`${styles.badge} ${styles.badgeCurrent}`}>Current</span>}
                    {stint.corrected && <span className={styles.badge}>Corrected</span>}
                  </div>
                  {stint.changes.length > 0 && <ul className={styles.changes}>{stint.changes.map((change) => <li key={change}>{change}</li>)}</ul>}
                  {stint.reason && <p className={styles.reason}>{stint.reason}</p>}
                  <div className={styles.footnote}>
                    <span>{sourceLabel(stint.source)}{stint.recordedBy ? ` by ${stint.recordedBy}` : ""} on {formatDay(stint.recordedAt)}</span>
                    {data.canRecord && <button type="button" className={styles.link} onClick={() => setForm({ mode: "correct", entry: stint })}>Correct this entry</button>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <ul className={styles.tree} aria-label="Career by company">
              <TreeNode node={view.tree} colourFor={(id) => colours.get(id.replace(/^company:/, "")) ?? null} />
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function sourceLabel(source: string): string {
  switch (source) {
    case "backfill": return "Taken from the employee record when history started";
    case "record_created": return "Recorded when the employee was added";
    case "profile_edit": return "Recorded from an edit to the employee record";
    case "history": return "Past position recorded";
    case "correction": return "Correction recorded";
    default: return "Move recorded";
  }
}

function TreeNode({ node, colourFor }: { node: CareerTreeNode; colourFor: (id: string) => string | null }) {
  const className = node.kind === "group" ? styles.cardGroup : node.kind === "company" ? styles.cardCompany : `${styles.cardRole} ${node.current ? styles.current : ""}`;
  const colour = node.kind === "company" ? colourFor(node.id) : null;
  return (
    <li className={styles.node}>
      <div className={`${styles.card} ${className}`} style={colour ? ({ "--dot": colour } as CSSProperties) : undefined}>
        <span className={styles.cardTitle}>{node.label}{node.current ? " · current" : ""}</span>
        {node.kind === "role" ? (
          <span className={styles.cardMeta}>
            {[node.detail, `${formatDay(node.from)} – ${node.current ? "present" : formatDay(node.to)}`, durationLabel(node.months ?? 0)].filter(Boolean).join(" · ")}
            {node.movementType && node.movementType !== "joined" ? ` · ${MOVEMENT_LABELS[node.movementType]}` : ""}
          </span>
        ) : (
          <span className={styles.cardMeta}>{[node.detail, node.months ? `${durationLabel(node.months)} in total` : null].filter(Boolean).join(" · ")}</span>
        )}
      </div>
      {node.children.length > 0 && <ul>{node.children.map((child) => <TreeNode key={child.id} node={child} colourFor={colourFor} />)}</ul>}
    </li>
  );
}

type PersonOption = { id: string; name: string; code: string };

function companyLabel(company: Company, companies: Company[]): string {
  const byId = new Map(companies.map((item) => [item.id, item]));
  const path: string[] = [];
  const seen = new Set<string>();
  let cursor: Company | undefined = company;
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor.name);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return `${path.join(" › ")} (${COMPANY_KIND_LABELS[company.kind]})`;
}

function MoveForm({ data, form, onCancel, onSaved }: { data: CareerPayload; form: FormState; onCancel: () => void; onSaved: () => void }) {
  const correcting = form.mode === "correct" ? form.entry : null;
  const latest = data.view.stints[data.view.stints.length - 1];
  const base = correcting ?? latest;
  const isFirst = correcting ? data.view.stints[0]?.id === correcting.id : false;
  const [people, setPeople] = useState<PersonOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/people?pageSize=200", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!active || !Array.isArray(json?.data)) return;
        setPeople(json.data
          .filter((item: { id: string }) => item.id !== data.employee.id)
          .map((item: { id: string; firstName?: string; lastName?: string; employeeCode?: string }) => ({ id: item.id, name: `${item.firstName ?? ""} ${item.lastName ?? ""}`.trim(), code: item.employeeCode ?? "" })));
      })
      .catch(() => {});
    return () => { active = false; };
  }, [data.employee.id]);

  const typeOptions: MovementType[] = correcting ? (isFirst ? ["joined"] : [...RECORDABLE_MOVES, "updated"]) : [...RECORDABLE_MOVES];
  const companies = data.companies.filter((company) => company.status === "active" || company.id === base?.companyId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = String(values.get(key) ?? "").trim();
      return value === "" ? null : value;
    };
    const body = {
      movementType: String(values.get("movementType")),
      effectiveFrom: String(values.get("effectiveFrom")),
      companyId: text("companyId"),
      designation: text("designation"),
      grade: text("grade"),
      department: text("department"),
      location: text("location"),
      managerId: text("managerId"),
      reason: String(values.get("reason") ?? "").trim(),
    };
    setBusy(true);
    setError("");
    const url = correcting
      ? `/api/v1/career-history/${encodeURIComponent(data.employee.id)}/corrections/${encodeURIComponent(correcting.id)}`
      : `/api/v1/career-history/${encodeURIComponent(data.employee.id)}`;
    const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const json = await response?.json().catch(() => null);
      setError(json?.error?.message ?? "The change could not be saved.");
      return;
    }
    window.dispatchEvent(new CustomEvent("nucleus:career-changed", { detail: { employeeId: data.employee.id } }));
    onSaved();
  }

  return (
    <form className={styles.form} onSubmit={submit} aria-label={correcting ? "Correct a history entry" : "Record a move"}>
      <h4>{correcting ? `Correct: ${correcting.designation ?? "entry"} from ${formatDay(correcting.effectiveFrom)}` : "Record a move"}</h4>
      {correcting && <p className={styles.meta} style={{ margin: 0 }}>The original entry is kept and marked as corrected. Leave a field empty to clear it.</p>}
      {!correcting && <p className={styles.meta} style={{ margin: 0 }}>A move dated on or after the current position updates the employee record. An earlier date adds a past position to the history only.</p>}
      {error && <div className={styles.alert} role="alert">{error}</div>}
      <div className={styles.grid}>
        <label className={styles.field}>Type of move
          <select name="movementType" defaultValue={correcting?.movementType ?? "promotion"} required>
            {typeOptions.map((type) => <option key={type} value={type}>{MOVEMENT_LABELS[type]}</option>)}
          </select>
        </label>
        <label className={styles.field}>Effective from
          <input type="date" name="effectiveFrom" required max={data.today} defaultValue={correcting?.effectiveFrom ?? data.today} />
        </label>
        <label className={styles.field}>Company
          <select name="companyId" defaultValue={base?.companyId ?? ""}>
            <option value="">Not recorded</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{companyLabel(company, data.companies)}</option>)}
          </select>
          {data.companies.length === 0 && <span className={styles.hint}>No companies yet. Add them under People › Legal entities › Group structure.</span>}
        </label>
        <label className={styles.field}>Designation
          <input name="designation" maxLength={120} defaultValue={base?.designation ?? ""} />
        </label>
        <label className={styles.field}>Grade / band
          <input name="grade" maxLength={40} defaultValue={base?.grade ?? ""} />
        </label>
        <label className={styles.field}>Department
          <input name="department" maxLength={80} defaultValue={base?.department ?? ""} />
        </label>
        <label className={styles.field}>Location
          <input name="location" maxLength={80} defaultValue={base?.location ?? ""} />
        </label>
        <label className={styles.field}>Reports to
          <select name="managerId" defaultValue={base?.managerId ?? ""}>
            <option value="">No manager</option>
            {base?.managerId && !people.some((person) => person.id === base.managerId) && <option value={base.managerId}>{base.managerName ?? "Current manager"}</option>}
            {people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.code ? ` (${person.code})` : ""}</option>)}
          </select>
        </label>
      </div>
      <label className={styles.field}>Reason
        <textarea name="reason" required minLength={5} maxLength={1000} placeholder={correcting ? "Why this entry was wrong" : "For example: promoted after the annual review"} />
      </label>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : correcting ? "Save correction" : "Record move"}</button>
      </div>
    </form>
  );
}
