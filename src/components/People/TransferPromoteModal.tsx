"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "@/context/I18nContext";
import { Alert, Button, Drawer, Field, Input, Select, Textarea } from "@/design/redesign/ui";
import {
  createMovementSchema, EMPLOYMENT_MOVEMENT_LABELS, EMPLOYMENT_MOVEMENT_TYPES, movementIssues,
  type CreateMovementInput, type EmploymentMovementType, type MovementEmployee,
} from "@/lib/employment-movements";
import { announcePeopleChange, fetchCompanies, postMovement, type CompanyOption } from "./movement-api";

export type TransferPromoteEmployee = MovementEmployee;

type Props = { open: boolean; employee: TransferPromoteEmployee; today: string; hasHire: boolean; onClose: () => void; onSaved?: (status: "applied" | "scheduled") => void };
type Draft = { movementType: EmploymentMovementType; toCompanyId: string; toDesignation: string; toDepartment: string; toCurrency: string; effectiveDate: string; remarks: string };

/** Records an intra-group movement (POST /api/v1/employees/:id/movements). Companies come from the group structure API. */
export default function TransferPromoteModal({ open, employee, today, hasHire, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<{ state: "loading" } | { state: "error"; message: string } | { state: "ready"; items: CompanyOption[] }>({ state: "loading" });
  const initial = useMemo<Draft>(() => ({
    movementType: "PROMOTION", toCompanyId: employee.companyId ?? "", toDesignation: employee.designation ?? "", toDepartment: employee.department ?? "",
    toCurrency: employee.currency ?? "", effectiveDate: today, remarks: "",
  }), [employee, today]);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const keyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initial); setErrors({}); setFormError(null); keyRef.current = null;
    let active = true;
    setCompanies({ state: "loading" });
    void fetchCompanies().then((result) => {
      if (!active) return;
      if (result.ok && result.data) setCompanies({ state: "ready", items: result.data.filter((company) => company.status === "active") });
      else setCompanies({ state: "error", message: result.message || t("people.movements.companiesError", "The group's companies could not be loaded.") });
    });
    return () => { active = false; };
  }, [open, initial, t]);

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    keyRef.current = null;
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "toCompanyId" && companies.state === "ready") {
        const company = companies.items.find((item) => item.id === value);
        if (company && value !== employee.companyId) next.toCurrency = company.currencyCode;
      }
      return next;
    });
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const toInput = (): CreateMovementInput => ({
    movementType: draft.movementType, toCompanyId: draft.toCompanyId,
    toDesignation: draft.toDesignation.trim() || null, toDepartment: draft.toDepartment.trim() || null,
    toCurrency: draft.toCurrency.trim().toUpperCase() || null, effectiveDate: draft.effectiveDate, remarks: draft.remarks.trim() || null,
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = createMovementSchema.safeParse(toInput());
    const fieldErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
    else for (const issue of movementIssues(parsed.data, { companyId: employee.companyId, designation: employee.designation, department: employee.department, currency: employee.currency }, { hasHire, today, joiningDate: employee.joiningDate })) fieldErrors[issue.field] ??= issue.issue;
    if (!parsed.success || Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }
    keyRef.current ??= crypto.randomUUID();
    setPending(true);
    const result = await postMovement(employee.id, parsed.data, keyRef.current);
    setPending(false);
    if (!result.ok) {
      const mapped: Record<string, string> = {};
      for (const detail of result.details) mapped[detail.field] = detail.issue;
      setErrors(mapped);
      setFormError(result.message || t("people.movements.saveError", "The movement could not be saved. Check your connection and try again."));
      return;
    }
    announcePeopleChange({ employeeId: employee.id, kind: "movement" });
    onSaved?.(result.data?.status ?? "applied");
    onClose();
  }

  const companyName = (id: string | null) => (companies.state === "ready" ? companies.items.find((item) => item.id === id)?.name : null) ?? t("people.movements.noCompany", "No company recorded");

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => { if (!next && !pending) onClose(); }}
      title={t("people.movements.title", "Transfer or promote")}
      description={`${employee.name} · ${companyName(employee.companyId)}`}
      footer={<>
        <Button onClick={onClose} disabled={pending}>{t("common.cancel", "Cancel")}</Button>
        <Button variant="primary" type="submit" form="transfer-promote-form" disabled={pending || companies.state !== "ready"}>
          {pending ? t("people.movements.saving", "Saving…") : t("people.movements.save", "Record movement")}
        </Button>
      </>}
    >
      <form id="transfer-promote-form" onSubmit={(event) => void submit(event)} noValidate>
        {formError && <Alert tone="danger">{formError}</Alert>}
        {companies.state === "error" && <Alert tone="danger">{companies.message}</Alert>}
        <Field id="mv-type" label={t("people.movements.type", "Movement")} required error={errors.movementType}>
          <Select id="mv-type" value={draft.movementType} onChange={(event) => update("movementType", event.target.value as EmploymentMovementType)}>
            {EMPLOYMENT_MOVEMENT_TYPES.filter((type) => type !== "HIRE" || !hasHire).map((type) => (
              <option key={type} value={type}>{t(`people.movements.types.${type}`, EMPLOYMENT_MOVEMENT_LABELS[type])}</option>
            ))}
          </Select>
        </Field>
        <Field id="mv-company" label={t("people.movements.toCompany", "To company")} required error={errors.toCompanyId}>
          <Select id="mv-company" value={draft.toCompanyId} disabled={companies.state !== "ready"} aria-busy={companies.state === "loading"} onChange={(event) => update("toCompanyId", event.target.value)}>
            <option value="">{companies.state === "loading" ? t("people.movements.loadingCompanies", "Loading companies…") : t("people.movements.chooseCompany", "Choose a company")}</option>
            {companies.state === "ready" && companies.items.map((company) => (
              <option key={company.id} value={company.id}>{company.name}{company.industry ? ` · ${company.industry}` : ""}</option>
            ))}
          </Select>
        </Field>
        <Field id="mv-designation" label={t("people.movements.toDesignation", "Designation")} error={errors.toDesignation} hint={employee.designation ? t("people.movements.currently", "Currently: {value}", { value: employee.designation }) : undefined}>
          <Input id="mv-designation" value={draft.toDesignation} maxLength={120} onChange={(event) => update("toDesignation", event.target.value)} />
        </Field>
        <Field id="mv-department" label={t("people.movements.toDepartment", "Department")} error={errors.toDepartment} hint={employee.department ? t("people.movements.currently", "Currently: {value}", { value: employee.department }) : undefined}>
          <Input id="mv-department" value={draft.toDepartment} maxLength={80} onChange={(event) => update("toDepartment", event.target.value)} />
        </Field>
        <Field id="mv-currency" label={t("people.movements.toCurrency", "Payroll currency")} error={errors.toCurrency}>
          <Input id="mv-currency" value={draft.toCurrency} maxLength={3} onChange={(event) => update("toCurrency", event.target.value.toUpperCase())} />
        </Field>
        <Field id="mv-date" label={t("people.movements.effectiveDate", "Effective date")} required error={errors.effectiveDate}
          hint={draft.effectiveDate > today ? t("people.movements.scheduledHint", "A future date is applied to the employee record automatically on that day.") : undefined}>
          <Input id="mv-date" type="date" value={draft.effectiveDate} min={employee.joiningDate ?? undefined} onChange={(event) => update("effectiveDate", event.target.value)} />
        </Field>
        <Field id="mv-remarks" label={t("people.movements.remarks", "Remarks (optional)")} error={errors.remarks}>
          <Textarea id="mv-remarks" value={draft.remarks} maxLength={1000} rows={3} onChange={(event) => update("remarks", event.target.value)} />
        </Field>
      </form>
    </Drawer>
  );
}
