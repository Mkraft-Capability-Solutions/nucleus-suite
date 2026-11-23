"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { AlertTriangle, Settings2, ShieldCheck } from "lucide-react";
import { FLAG_RULES, FLAG_RULE_BY_KEY, formatDay, type FlagRule, type FlagRuleKey, type FlagSeverity } from "@/lib/employee-flags";
import { Alert, Badge, Button, Drawer, EmptyState, ErrorState, Panel, Select, SkeletonRows, cx, ui } from "@/design/redesign/ui";
import { getJson } from "../data";
import styles from "./Flags.module.css";

type FlagItem = {
  id: string; employeeId: string; rule: FlagRuleKey; severity: FlagSeverity; dueDate: string | null; daysLeft: number | null; detail: string;
  employee: { id: string; code: string; name: string; designation: string | null; department: string | null; location: string | null; companyId: string | null; company: string | null };
};
type FlagsPayload = {
  today: string;
  rules: FlagRule[];
  rulesUpdatedAt: string | null;
  flags: FlagItem[];
  summary: { alerts: number; warnings: number; employees: number; checked: number };
  options: { companies: Array<{ id: string; name: string; parentId: string | null }>; locations: string[]; departments: string[] };
};

/** Companies in group order (parents before their children), indented by depth. */
function companyOptions(companies: FlagsPayload["options"]["companies"]) {
  const result: Array<{ id: string; label: string }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const company of companies.filter((entry) => entry.parentId === parentId)) {
      result.push({ id: company.id, label: `${"  ".repeat(depth)}${depth ? "└ " : ""}${company.name}` });
      visit(company.id, depth + 1);
    }
  };
  visit(null, 0);
  // Companies whose parent is not listed (should not happen) still appear.
  for (const company of companies) if (!result.some((entry) => entry.id === company.id)) result.push({ id: company.id, label: company.name });
  return result;
}

function ruleSummary(rule: FlagRule): string {
  if (!rule.enabled) return "Off";
  const definition = FLAG_RULE_BY_KEY[rule.key];
  const setting = definition.setting ? ` · ${definition.setting.label.toLowerCase()} ${rule.settings[definition.setting.key]} ${definition.setting.unit}` : "";
  const alert = rule.alertDays === 0 ? "alert when due" : `alert ${rule.alertDays} days before`;
  return `Warning ${rule.warningDays} days before · ${alert}${setting}`;
}

/**
 * Warnings and alerts across the organisation and every company of the group. Read-only: the flags
 * come from the employee records, so they clear when the record is updated. Administrators set the
 * rules (when a warning or an alert starts) from here.
 */
export default function Flags({ canManageRules, onOpenEmployee }: { canManageRules: boolean; onOpenEmployee: (id: string) => void }) {
  const [filters, setFilters] = useState({ company: "", location: "", department: "", severity: "", rule: "" });
  const [rulesOpen, setRulesOpen] = useState(false);
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const flags = useSWR<{ data: FlagsPayload }>(`/api/v1/employee-flags${query ? `?${query}` : ""}`, getJson, { keepPreviousData: true, revalidateOnFocus: false });
  const data = flags.data?.data;
  const companies = useMemo(() => companyOptions(data?.options.companies ?? []), [data?.options.companies]);
  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));

  if (flags.error && !data) return <ErrorState message={(flags.error as Error).message} onRetry={() => void flags.mutate()} />;

  const metrics = [
    { label: "Alerts", value: data?.summary.alerts, detail: "Expired, overdue or due very soon", tone: "alert" },
    { label: "Warnings", value: data?.summary.warnings, detail: "Coming up within the warning window", tone: "warning" },
    { label: "Employees flagged", value: data?.summary.employees, detail: data ? `of ${data.summary.checked.toLocaleString("en-IN")} active records checked` : "", tone: "" },
  ];

  return (
    <div className={cx(styles.stack, ui.fit)}>
      <div className={styles.metrics} role="list">
        {metrics.map((metric) => (
          <div key={metric.label} role="listitem" className={styles.metric}>
            <span className={styles.metricLabel}>{metric.tone && <span className={cx(styles.dot, metric.tone === "alert" ? styles.dotAlert : styles.dotWarning)} aria-hidden="true" />}{metric.label}</span>
            <span className={styles.metricValue}>{metric.value === undefined ? "—" : metric.value.toLocaleString("en-IN")}</span>
            <span className={styles.metricDetail}>{metric.detail}</span>
          </div>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={ui.pills} role="group" aria-label="Severity">
          {[["", "All"], ["alert", "Alerts"], ["warning", "Warnings"]].map(([value, label]) => (
            <button key={value} type="button" className={ui.pill} aria-pressed={filters.severity === value} onClick={() => set("severity", value)}>{label}</button>
          ))}
        </div>
        <div className={styles.filters}>
          <Select aria-label="Company" value={filters.company} onChange={(event) => set("company", event.target.value)}>
            <option value="">All companies</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.label}</option>)}
          </Select>
          <Select aria-label="Location" value={filters.location} onChange={(event) => set("location", event.target.value)}>
            <option value="">All locations</option>
            {(data?.options.locations ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select aria-label="Department" value={filters.department} onChange={(event) => set("department", event.target.value)}>
            <option value="">All departments</option>
            {(data?.options.departments ?? []).map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>
          <Select aria-label="Rule" value={filters.rule} onChange={(event) => set("rule", event.target.value)}>
            <option value="">Every rule</option>
            {FLAG_RULES.map((rule) => <option key={rule.key} value={rule.key}>{rule.label}</option>)}
          </Select>
        </div>
      </div>

      <Panel
        fill
        title="Warnings and alerts"
        subtitle={data ? `As of ${formatDay(data.today)}. Read-only: a flag clears when the employee's record is updated.` : "Loading…"}
        actions={<Button size="sm" icon={Settings2} onClick={() => setRulesOpen(true)}>{canManageRules ? "Set up rules" : "Rules"}</Button>}
        flush
      >
        {!data ? <SkeletonRows rows={6} columns={5} /> : data.flags.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No warnings or alerts">
            {query ? "Nothing matches these filters." : "No employee record meets a rule's warning or alert window today."}
          </EmptyState>
        ) : (
          <div className={ui.tableWrap}>
            <table className={cx(ui.table, styles.table)}>
              <thead>
                <tr><th scope="col">Severity</th><th scope="col">Employee</th><th scope="col">What</th><th scope="col">Due</th><th scope="col">Company</th><th scope="col">Location</th><th scope="col">Department</th></tr>
              </thead>
              <tbody>
                {data.flags.map((flag) => (
                  <tr key={flag.id}>
                    <td><Badge tone={flag.severity === "alert" ? "danger" : "warning"} dot>{flag.severity === "alert" ? "Alert" : "Warning"}</Badge></td>
                    <td>
                      <button type="button" className={styles.person} onClick={() => onOpenEmployee(flag.employee.id)}>
                        <span className={styles.strong}>{flag.employee.name}</span>
                        <span className={styles.sub}>{flag.employee.code}{flag.employee.designation ? ` · ${flag.employee.designation}` : ""}</span>
                      </button>
                    </td>
                    <td><span className={styles.strong}>{FLAG_RULE_BY_KEY[flag.rule].label}</span><span className={styles.sub}>{flag.detail}</span></td>
                    <td className={styles.nowrap}>{flag.dueDate ? formatDay(flag.dueDate) : "—"}</td>
                    <td>{flag.employee.company ?? "—"}</td>
                    <td>{flag.employee.location ?? "—"}</td>
                    <td>{flag.employee.department ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {rulesOpen && data && (
        <RulesDrawer rules={data.rules} canManage={canManageRules} onClose={() => setRulesOpen(false)} onSaved={() => { setRulesOpen(false); void flags.mutate(); }} />
      )}
    </div>
  );
}

function RulesDrawer({ rules, canManage, onClose, onSaved }: { rules: FlagRule[]; canManage: boolean; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<FlagRule[]>(rules);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const update = (key: FlagRuleKey, change: Partial<FlagRule>) => setDraft((current) => current.map((rule) => (rule.key === key ? { ...rule, ...change, settings: { ...rule.settings, ...(change.settings ?? {}) } } : rule)));
  const invalid = draft.find((rule) => rule.alertDays > rule.warningDays);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/employee-flags/rules", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: draft }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.details?.[0]?.issue ?? body?.error?.message ?? "The rules could not be saved.");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The rules could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const number = (value: string) => (value === "" ? 0 : Math.max(0, Math.round(Number(value))));

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={canManage ? "Set up warning and alert rules" : "Warning and alert rules"}
      description="Each rule reads a date from the employee record. A warning starts the given number of days before that date; an alert starts later, and stays once the date has passed."
      footer={canManage ? <><Button onClick={onClose}>Cancel</Button><Button variant="primary" loading={saving} disabled={Boolean(invalid)} onClick={() => void save()}>Save rules</Button></> : <Button onClick={onClose}>Close</Button>}>
      <div className={styles.rules}>
        {!canManage && <Alert tone="info">Only administrators can change these rules.</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}
        {draft.map((rule) => {
          const definition = FLAG_RULE_BY_KEY[rule.key];
          const bad = rule.alertDays > rule.warningDays;
          return (
            <section key={rule.key} className={cx(styles.rule, !rule.enabled && styles.ruleOff)} aria-labelledby={`rule-${rule.key}`}>
              <div className={styles.ruleHead}>
                <div>
                  <h3 id={`rule-${rule.key}`} className={styles.ruleTitle}>{definition.label}</h3>
                  <p className={styles.ruleText}>{definition.description}</p>
                  <p className={styles.ruleSource}>From: {definition.source}</p>
                </div>
                <label className={styles.switch}>
                  <input type="checkbox" role="switch" checked={rule.enabled} disabled={!canManage} onChange={(event) => update(rule.key, { enabled: event.target.checked })} aria-label={`${definition.label} on`} />
                  <span>{rule.enabled ? "On" : "Off"}</span>
                </label>
              </div>
              <div className={styles.ruleFields}>
                <label className={styles.ruleField}>
                  <span><span className={cx(styles.dot, styles.dotWarning)} aria-hidden="true" />Warning from</span>
                  <span className={styles.inputUnit}><input className={ui.input} type="number" min={0} max={730} value={rule.warningDays} disabled={!canManage || !rule.enabled} onChange={(event) => update(rule.key, { warningDays: number(event.target.value) })} />days before</span>
                </label>
                <label className={styles.ruleField}>
                  <span><span className={cx(styles.dot, styles.dotAlert)} aria-hidden="true" />Alert from</span>
                  <span className={styles.inputUnit}><input className={ui.input} type="number" min={0} max={730} value={rule.alertDays} disabled={!canManage || !rule.enabled} aria-invalid={bad} onChange={(event) => update(rule.key, { alertDays: number(event.target.value) })} />days before</span>
                </label>
                {definition.setting && (
                  <label className={styles.ruleField}>
                    <span>{definition.setting.label}</span>
                    <span className={styles.inputUnit}><input className={ui.input} type="number" min={definition.setting.min} max={definition.setting.max} value={rule.settings[definition.setting.key] ?? ""} disabled={!canManage || !rule.enabled}
                      onChange={(event) => update(rule.key, { settings: { [definition.setting!.key]: Math.min(definition.setting!.max, Math.max(definition.setting!.min, number(event.target.value))) } })} />{definition.setting.unit}</span>
                  </label>
                )}
              </div>
              {bad && <p className={styles.ruleError} role="alert"><AlertTriangle aria-hidden="true" />The alert cannot start earlier than the warning.</p>}
              {rule.key === "medical_exam_due" && <p className={styles.ruleNote}>A fitness status of “Unfit” is always an alert and “Pending” a warning.</p>}
              <p className={styles.ruleNote}>{ruleSummary(rule)}</p>
            </section>
          );
        })}
      </div>
    </Drawer>
  );
}
