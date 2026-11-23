"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { Alert, Badge, Button, EmptyState, ErrorState, SkeletonRows } from "@/design/redesign/ui";
import {
  EMPLOYMENT_MOVEMENT_LABELS, PEOPLE_CHANGED_EVENT, tenureLabel,
  type MovementList, type MovementRecord, type PeopleChangedDetail,
} from "@/lib/employment-movements";
import { formatDay } from "./CareerHistory";
import { fetchMovements } from "./movement-api";
import TransferPromoteModal from "./TransferPromoteModal";
import styles from "./CareerHistory.module.css";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; data: MovementList };

/** Intra-group movement trail (GET /api/v1/employees/:id/movements), newest first, with the transfer/promote action. */
export default function EmploymentTimeline({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void fetchMovements(employeeId).then((result) => {
      if (!active) return;
      if (result.ok && result.data) setLoad({ state: "ready", data: result.data });
      else setLoad({ state: "error", message: result.message || t("people.movements.loadError", "The movement history could not be loaded.") });
    });
    return () => { active = false; };
  }, [employeeId, version, t]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<PeopleChangedDetail>).detail;
      if (!detail || detail.employeeId === employeeId) reload();
    };
    window.addEventListener(PEOPLE_CHANGED_EVENT, listener);
    return () => window.removeEventListener(PEOPLE_CHANGED_EVENT, listener);
  }, [employeeId, reload]);

  if (load.state === "loading") return <div role="status" aria-label={t("people.movements.loading", "Loading movements…")}><SkeletonRows rows={3} columns={3} /></div>;
  if (load.state === "error") return <ErrorState message={load.message} onRetry={reload} />;
  const { data } = load;
  const items = [...data.items].reverse();

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <span>{t("people.movements.count", "Movements: {count}", { count: data.total })}</span>
        {data.canRecord && <Button variant="primary" icon={ArrowRightLeft} onClick={() => setOpen(true)}>{t("people.movements.title", "Transfer or promote")}</Button>}
      </div>
      {notice && <div aria-live="polite"><Alert tone="success">{notice}</Alert></div>}
      {items.length === 0 ? (
        <EmptyState title={t("people.movements.emptyTitle", "No movements recorded")}>{t("people.movements.emptyBody", "Transfers, promotions and deputations across the group appear here.")}</EmptyState>
      ) : (
        <ol className={styles.timeline} aria-label={t("people.movements.timelineLabel", "Employment movements, most recent first")}>
          {items.map((item) => <MovementItem key={item.id} item={item} />)}
        </ol>
      )}
      {open && (
        <TransferPromoteModal
          open={open}
          employee={data.employee}
          today={data.today}
          hasHire={data.hasHire}
          onClose={() => setOpen(false)}
          onSaved={(status) => setNotice(status === "scheduled"
            ? t("people.movements.savedScheduled", "Movement recorded. It will be applied on its effective date.")
            : t("people.movements.savedApplied", "Movement recorded and applied to the employee record."))}
        />
      )}
    </div>
  );
}

function MovementItem({ item }: { item: MovementRecord }) {
  const { t } = useTranslation();
  const label = t(`people.movements.types.${item.movementType}`, EMPLOYMENT_MOVEMENT_LABELS[item.movementType]);
  return (
    <li className={styles.event}>
      <span className={styles.dot} aria-hidden="true" />
      <div className={styles.eventHead}>
        <h4 className={styles.eventTitle}>{label}</h4>
        <span className={styles.when}>{formatDay(item.effectiveDate)}{item.tenureDays !== null ? ` · ${tenureLabel(item.tenureDays)}` : ""}</span>
      </div>
      <div className={styles.badges}>
        {item.fromCompany && item.fromCompany.id !== item.toCompany.id && <><Badge>{item.fromCompany.name}</Badge><span aria-hidden="true">→</span></>}
        <Badge tone="accent">{item.toCompany.name}</Badge>
        {item.status === "scheduled" && <Badge tone="warning">{t("people.movements.scheduled", "Scheduled")}</Badge>}
        {item.industryChanged && <Badge tone="info">{t("people.movements.industryChange", "{from} → {to}", { from: item.fromCompany?.industry ?? "—", to: item.toCompany.industry ?? "—" })}</Badge>}
      </div>
      <ul className={styles.changes}>
        {item.designationChanged && <li>{t("people.movements.designationDelta", "Designation: {from} → {to}", { from: item.fromDesignation ?? "—", to: item.toDesignation ?? "—" })}</li>}
        {(item.fromDepartment ?? null) !== (item.toDepartment ?? null) && <li>{t("people.movements.departmentDelta", "Department: {from} → {to}", { from: item.fromDepartment ?? "—", to: item.toDepartment ?? "—" })}</li>}
        {(item.fromCurrency ?? null) !== (item.toCurrency ?? null) && <li>{t("people.movements.currencyDelta", "Payroll currency: {from} → {to}", { from: item.fromCurrency ?? "—", to: item.toCurrency ?? "—" })}</li>}
      </ul>
      {item.remarks && <p className={styles.reason}>{item.remarks}</p>}
      <div className={styles.footnote}>
        <span>{t("people.movements.recordedOn", "Recorded on {date}", { date: formatDay(item.createdAt) })}{item.createdBy ? ` · ${item.createdBy}` : ""}{item.approvedBy ? ` · ${t("people.movements.approvedBy", "Approved by {name}", { name: item.approvedBy })}` : ""}</span>
      </div>
    </li>
  );
}
