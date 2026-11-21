"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, Plus } from "lucide-react";
import { COMPANY_KIND_LABELS, COMPANY_KINDS, type Company } from "@/lib/career";
import styles from "./CareerHistory.module.css";

type CompanyRow = Company & { headcount: number };
type TreeItem = CompanyRow & { children: TreeItem[] };

function buildTree(companies: CompanyRow[]): TreeItem[] {
  const items = new Map(companies.map((company) => [company.id, { ...company, children: [] as TreeItem[] }]));
  const roots: TreeItem[] = [];
  for (const item of items.values()) {
    const parent = item.parentId ? items.get(item.parentId) : undefined;
    if (parent) parent.children.push(item);
    else roots.push(item);
  }
  const sort = (list: TreeItem[]) => { list.sort((a, b) => a.name.localeCompare(b.name)); list.forEach((item) => sort(item.children)); };
  sort(roots);
  return roots;
}

/** Descendants of a company (it cannot be moved under any of them). */
function descendantIds(companies: CompanyRow[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const company of companies) {
      if (company.parentId && result.has(company.parentId) && !result.has(company.id)) { result.add(company.id); grew = true; }
    }
  }
  return result;
}

/**
 * The group's companies as a tree (People › Legal entities). Owners and administrators can add a
 * company or move one under another parent; everyone with access to People can read it.
 */
export default function GroupStructurePanel() {
  const [companies, setCompanies] = useState<CompanyRow[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<CompanyRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/organization/companies", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!active) return;
        if (!response.ok) setError(body?.error?.message ?? "The group structure could not be loaded.");
        else setCompanies(body.data as CompanyRow[]);
      })
      .catch(() => active && setError("The group structure could not be loaded."));
    return () => { active = false; };
  }, [version]);

  const tree = useMemo(() => buildTree(companies ?? []), [companies]);

  async function send(url: string, method: "POST" | "PATCH", body: unknown) {
    setBusy(true);
    setError("");
    const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const json = await response?.json().catch(() => null);
      setError(response?.status === 403 ? "Only owners and administrators can change the group structure." : json?.error?.message ?? "The change could not be saved.");
      return false;
    }
    setAdding(false);
    setMoving(null);
    setVersion((value) => value + 1);
    return true;
  }

  function addCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const text = (key: string) => String(values.get(key) ?? "").trim();
    void send("/api/v1/organization/companies", "POST", {
      name: text("name"), code: text("code"), parentId: text("parentId") || null, kind: text("kind"), industry: text("industry") || null,
    });
  }

  function moveCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!moving) return;
    const values = new FormData(event.currentTarget);
    void send(`/api/v1/organization/companies/${moving.id}`, "PATCH", {
      parentId: String(values.get("parentId") ?? "") || null,
      kind: String(values.get("kind")),
      reason: String(values.get("reason") ?? "").trim(),
    });
  }

  const renderItem = (item: TreeItem) => (
    <li key={item.id} className={styles.node}>
      <div className={`${styles.card} ${styles.cardCompany}`}>
        <span className={styles.cardTitle}>{item.name}{item.code ? ` (${item.code})` : ""}</span>
        <span className={styles.cardMeta}>
          {[COMPANY_KIND_LABELS[item.kind], item.industry, `${item.headcount} active ${item.headcount === 1 ? "employee" : "employees"}`, item.status !== "active" ? item.status : null].filter(Boolean).join(" · ")}
          {" · "}<button type="button" className={styles.link} onClick={() => { setMoving(item); setAdding(false); }}>Move</button>
        </span>
      </div>
      {item.children.length > 0 && <ul>{item.children.map(renderItem)}</ul>}
    </li>
  );

  return (
    <section style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "1rem 1.1rem", marginBottom: "1rem", background: "var(--card)" }} aria-labelledby="group-structure-title">
      <div className={styles.toolbar} style={{ marginBottom: "0.75rem" }}>
        <div>
          <h3 id="group-structure-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: "1rem" }}><Building2 size={18} /> Group structure</h3>
          <p className={styles.meta} style={{ margin: "0.2rem 0 0" }}>The parent company and the companies under it. Employee moves between these companies appear in each person&apos;s career history.</p>
        </div>
        <button type="button" className={styles.primary} onClick={() => { setAdding((value) => !value); setMoving(null); }}><Plus size={14} /> Add company</button>
      </div>
      {error && <div className={styles.alert} role="alert" style={{ marginBottom: "0.75rem" }}>{error}</div>}

      {adding && (
        <form className={styles.form} onSubmit={addCompany} style={{ marginBottom: "0.75rem" }} aria-label="Add a company">
          <div className={styles.grid}>
            <label className={styles.field}>Company name<input name="name" required minLength={2} maxLength={200} /></label>
            <label className={styles.field}>Code<input name="code" required maxLength={40} pattern="[A-Za-z0-9._\-]+" title="Letters, digits, dot, dash and underscore" /></label>
            <label className={styles.field}>Kind
              <select name="kind" defaultValue={companies?.length ? "subsidiary" : "holding"}>{COMPANY_KINDS.map((kind) => <option key={kind} value={kind}>{COMPANY_KIND_LABELS[kind]}</option>)}</select>
            </label>
            <label className={styles.field}>Parent company
              <select name="parentId" defaultValue="">
                <option value="">None (top of the group)</option>
                {(companies ?? []).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className={styles.field}>Industry<input name="industry" maxLength={120} placeholder="For example: Hospitality" /></label>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Add company"}</button>
          </div>
        </form>
      )}

      {moving && (
        <form className={styles.form} onSubmit={moveCompany} style={{ marginBottom: "0.75rem" }} aria-label={`Move ${moving.name}`}>
          <h4>Move {moving.name}</h4>
          <div className={styles.grid}>
            <label className={styles.field}>Parent company
              <select name="parentId" defaultValue={moving.parentId ?? ""}>
                <option value="">None (top of the group)</option>
                {(companies ?? []).filter((company) => !descendantIds(companies ?? [], moving.id).has(company.id)).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className={styles.field}>Kind
              <select name="kind" defaultValue={moving.kind}>{COMPANY_KINDS.map((kind) => <option key={kind} value={kind}>{COMPANY_KIND_LABELS[kind]}</option>)}</select>
            </label>
          </div>
          <label className={styles.field}>Reason<textarea name="reason" required minLength={5} maxLength={500} placeholder="For example: acquired by the holding company" /></label>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setMoving(null)}>Cancel</button>
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}

      {companies === null && !error && <p className={styles.notice} role="status">Loading the group structure…</p>}
      {companies !== null && companies.length === 0 && <p className={styles.notice}>No companies yet. Add the parent company first, then the companies under it.</p>}
      {tree.length > 0 && <ul className={styles.tree}>{tree.map(renderItem)}</ul>}
    </section>
  );
}
