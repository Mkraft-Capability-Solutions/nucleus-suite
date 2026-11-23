"use client";

import { useState } from "react";
import { Building2, CheckCircle2, DollarSign, Lock, ShieldCheck, UserCheck } from "lucide-react";
import { currentPeriod, formatMoney, formatNumber, useResource } from "./payroll-client";
import { DataState, NS, usePayrollT } from "./PayrollParts";
import type { WageRegister } from "./payroll-types";
import styles from "../PayrollView.module.css";

const PAGE_SIZE = 50;

/**
 * Head-office salary generation versus plant scoping. The register comes from
 * GET /api/v1/payroll-wage-register; the server decides whether pay fields are
 * included (the `compensation` field permission) and sends null when they are
 * masked, so nothing here hides a value the browser already has.
 */
export default function PayrollScopingTab() {
  const { t, locale } = usePayrollT();
  const [period, setPeriod] = useState(currentPeriod());
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const path = `/api/v1/payroll-wage-register?period=${encodeURIComponent(period)}&page=${page}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(query)}`;
  const register = useResource<WageRegister>(/^\d{4}-\d{2}$/.test(period) ? path : null);
  const viewer = register.state.status === "ready" ? register.state.data.viewer : null;
  const masked = viewer ? !viewer.compensationVisible : null;
  const perspectives: Array<{ key: string; label: string; icon: typeof UserCheck; active: boolean }> = [
    { key: "full", label: t(`${NS}.text_perspective_full`, "Head office HR (full pay view)"), icon: UserCheck, active: masked === false },
    { key: "masked", label: t(`${NS}.text_perspective_masked`, "Plant supervisor (pay masked)"), icon: Building2, active: masked === true },
    { key: "finance", label: t(`${NS}.text_perspective_finance`, "Finance controller"), icon: DollarSign, active: Boolean(viewer?.roles.some((role) => role.toLowerCase().includes("finance"))) },
  ];

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.accentCard}`} aria-labelledby="scoping-title">
        <div className={styles.rowBetween}>
          <div>
            <h3 id="scoping-title" className={styles.sectionTitle}><Building2 size={20} aria-hidden="true" />{t(`${NS}.text_scoping_title`, "Head office salary generation and plant scoping")}</h3>
            <p className={styles.intro}>{t(`${NS}.text_scoping_intro`, "Salary is generated centrally. Plant supervisors see attendance, shifts and overtime for their workers, but pay fields are withheld by the server unless their role may read compensation.")}</p>
          </div>
          <div className={styles.row} role="list" aria-label={t(`${NS}.text_perspectives`, "Access perspectives")}>
            {perspectives.map(({ key, label, icon: Icon, active }) => (
              <span key={key} role="listitem" className={`${styles.badge} ${active ? styles.badgeSuccess : styles.badgeInfo}`} aria-current={active ? "true" : undefined}>
                <Icon size={13} aria-hidden="true" />{label}
              </span>
            ))}
          </div>
        </div>
        <div className={`${styles.notice} ${masked ? "" : styles.noticeOk}`} role="status">
          <ShieldCheck size={16} aria-hidden="true" />{" "}
          {viewer === null
            ? t(`${NS}.text_scope_loading`, "Checking your access…")
            : masked
              ? t(`${NS}.text_scope_masked`, "Your role ({roles}) cannot read compensation, so pay fields are withheld. Attendance and overtime remain visible.", { roles: viewer.roles.join(", ") || "—" })
              : t(`${NS}.text_scope_full`, "Your role ({roles}) may read compensation: basic, gross and net pay are shown.", { roles: viewer.roles.join(", ") || "—" })}
        </div>
        <p className={styles.micro}>{t(`${NS}.text_role_preview_note`, "Role perspectives follow your signed-in role; preview another role from Access Control.")}</p>
      </section>

      <section className={styles.tableContainer} aria-labelledby="scoping-table">
        <div className={styles.tableHeader}>
          <strong id="scoping-table" className={styles.strongText}>{t(`${NS}.text_workforce_register`, "Workforce attendance and pay register")}</strong>
          <form className={styles.row} onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
            <label className={styles.srOnly} htmlFor="scoping-period">{t(`${NS}.text_period`, "Period")}</label>
            <input id="scoping-period" type="month" className={styles.formInput} value={period} onChange={(event) => { setPage(1); setPeriod(event.target.value); }} />
            <label className={styles.srOnly} htmlFor="scoping-search">{t(`${NS}.text_search_employees`, "Search employees")}</label>
            <input id="scoping-search" type="search" className={styles.formInput} maxLength={80} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t(`${NS}.text_search_employees`, "Search employees")} />
            <button type="submit" className={`${styles.btnSecondary} ${styles.btnSmall}`}>{t(`${NS}.text_search`, "Search")}</button>
          </form>
        </div>
        <DataState resource={register.state} onRetry={register.reload} isEmpty={(data) => data.items.length === 0} emptyText={t(`${NS}.text_no_workers`, "No employees match this period and search.")}>
          {(data) => (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th scope="col">{t(`${NS}.text_employee_code`, "Employee code")}</th>
                      <th scope="col">{t(`${NS}.text_worker_name`, "Worker name")}</th>
                      <th scope="col">{t(`${NS}.text_category`, "Category")}</th>
                      <th scope="col">{t(`${NS}.text_shift`, "Shift")}</th>
                      <th scope="col">{t(`${NS}.text_ot_hours`, "OT hours")}</th>
                      <th scope="col">{t(`${NS}.text_working_days`, "Working days")}</th>
                      <th scope="col">{t(`${NS}.text_basic_salary`, "Basic salary")}</th>
                      <th scope="col">{t(`${NS}.text_gross_wage`, "Gross wage")}</th>
                      <th scope="col">{t(`${NS}.text_net_payable`, "Net payable")}</th>
                      <th scope="col">{t(`${NS}.text_security_badge`, "Pay visibility")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => {
                      const pay = (minor: number | null) => row.masked ? <span className={styles.micro}>{t(`${NS}.text_masked`, "Withheld")}</span> : minor === null ? <span className={styles.micro}>{t(`${NS}.text_no_payslip_period`, "No payslip")}</span> : formatMoney(minor, row.currency, locale);
                      return (
                        <tr key={row.employeeId}>
                          <td className={styles.numeric}>{row.employeeCode}</td>
                          <td>
                            <div className={styles.strongText}>{row.name}</div>
                            <div className={styles.micro}>{[row.designation, row.department, row.location].filter(Boolean).join(" · ")}</div>
                          </td>
                          <td><span className={`${styles.badge} ${styles.badgeInfo}`}>{row.category ?? "—"}</span></td>
                          <td>{row.shift ?? <span className={styles.micro}>{t(`${NS}.text_no_attendance`, "No attendance")}</span>}</td>
                          <td className={styles.numeric}>{row.attendanceRecorded ? formatNumber(row.payableOtMinutes / 60, locale, 1) : "—"}</td>
                          <td className={styles.numeric}>{row.attendanceRecorded ? formatNumber(row.attendedDays, locale, 1) : "—"}</td>
                          <td className={styles.numeric}>{pay(row.basicMinor)}</td>
                          <td className={styles.numeric}>{pay(row.grossMinor)}</td>
                          <td className={`${styles.numeric} ${styles.positive}`}>{pay(row.netMinor)}</td>
                          <td>
                            {row.masked
                              ? <span className={`${styles.badge} ${styles.badgeWarning}`}><Lock size={11} aria-hidden="true" />{t(`${NS}.text_restricted`, "Restricted")}</span>
                              : <span className={`${styles.badge} ${styles.badgeSuccess}`}><CheckCircle2 size={11} aria-hidden="true" />{t(`${NS}.text_full_view`, "Full view")}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={styles.pager}>
                <span className={styles.micro}>{t(`${NS}.text_page_of`, "Page {page} · {total} employees", { page: data.page, total: data.total })}</span>
                <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t(`${NS}.text_previous`, "Previous")}</button>
                <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} disabled={!data.hasMore} onClick={() => setPage((value) => value + 1)}>{t(`${NS}.text_next`, "Next")}</button>
              </div>
            </>
          )}
        </DataState>
      </section>
    </div>
  );
}
