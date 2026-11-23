"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { send, useSubmitKey, type RoleView } from "./adminApi";
import { Notice, useT, useToast } from "./AdminParts";
import styles from "./Admin.module.css";

const NS = "components.Workspace.CreateRoleDialog";
/** Mirrors createRoleSchema in src/server/access/role-admin.ts. */
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;

function suggestCode(name: string): string {
  return name.trim().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 63);
}

export default function CreateRoleDialog({ roles, onClose, onCreated }: {
  roles: RoleView[];
  onClose: () => void;
  onCreated: (role: RoleView) => void;
}) {
  const t = useT();
  const toast = useToast();
  const submitKey = useSubmitKey();
  const titleId = useId();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [copyFrom, setCopyFrom] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; code?: string; form?: string }>({});

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const effectiveCode = codeTouched ? code : suggestCode(name);

  const validate = () => {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t(`${NS}.err_name`, "A role name is required.");
    else if (name.trim().length > 120) next.name = t(`${NS}.err_name_long`, "Use at most 120 characters.");
    if (!CODE_PATTERN.test(effectiveCode)) next.code = t(`${NS}.err_code`, "Use 2-63 lowercase letters, digits, - or _.");
    else if (roles.some((role) => role.code.toLowerCase() === effectiveCode)) next.code = t(`${NS}.err_code_taken`, "A role with this code already exists.");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (busy || !validate()) return;
    const body = { name: name.trim(), code: effectiveCode, ...(copyFrom ? { copyFromRoleId: copyFrom } : {}) };
    setBusy(true);
    const result = await send<RoleView>("/api/v1/roles", {
      method: "POST", body, idempotencyKey: submitKey.key(JSON.stringify(body)), fallback: t(`${NS}.err_failed`, "The role could not be created."),
    });
    setBusy(false);
    if (!result.ok) {
      const fieldIssue = result.error.details.find((detail) => detail.field === "code" || detail.field === "name");
      setErrors(fieldIssue ? { [fieldIssue.field]: result.error.message } : { form: result.error.message });
      return;
    }
    submitKey.done();
    toast(t(`${NS}.toast_title`, "Role created"), t(`${NS}.toast_body`, "{role} was created. Grant its access next.", { role: result.data.name }), "success");
    onCreated(result.data);
  };

  return (
    <div className={styles.overlay} role="presentation" onClick={() => !busy && onClose()}>
      <div className={`${styles.dialog} ${styles.dialogSmall}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className={styles.cardHeader}>
          <h3 id={titleId} className={styles.cardTitle}>{t(`${NS}.title`, "Create a role")}</h3>
          <button type="button" className={styles.btnGhost} onClick={onClose} disabled={busy} aria-label={t(`${NS}.close`, "Close")}><X size={18} /></button>
        </div>
        <form className={styles.toggleList} noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${titleId}-name`}>{t(`${NS}.name`, "Role name")}<span className={styles.required} aria-hidden="true">*</span></label>
            <input
              id={`${titleId}-name`} ref={nameRef} className={`${styles.input} ${errors.name ? styles.inputInvalid : ""}`} value={name} maxLength={120}
              aria-required="true" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${titleId}-name-err` : undefined}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name && <span id={`${titleId}-name-err`} className={styles.fieldError}>{errors.name}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${titleId}-code`}>{t(`${NS}.code`, "Role code")}<span className={styles.required} aria-hidden="true">*</span></label>
            <input
              id={`${titleId}-code`} className={`${styles.input} ${styles.mono} ${errors.code ? styles.inputInvalid : ""}`} value={effectiveCode} maxLength={63}
              aria-required="true" aria-invalid={Boolean(errors.code)} aria-describedby={`${titleId}-code-help`}
              onChange={(event) => { setCodeTouched(true); setCode(event.target.value.toLowerCase()); }}
            />
            <span id={`${titleId}-code-help`} className={errors.code ? styles.fieldError : styles.help}>
              {errors.code ?? t(`${NS}.code_help`, "A stable identifier; it cannot be changed later.")}
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor={`${titleId}-copy`}>{t(`${NS}.copy`, "Start from the actions of")}<span className={styles.optional}>{t(`${NS}.optional`, "(optional)")}</span></label>
            <select id={`${titleId}-copy`} className={styles.select} value={copyFrom} onChange={(event) => setCopyFrom(event.target.value)}>
              <option value="">{t(`${NS}.copy_none`, "No actions (empty role)")}</option>
              {roles.filter((role) => !role.privileged).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </div>
          {errors.form && <Notice tone="error">{errors.form}</Notice>}
          <div className={styles.footer}>
            <button type="button" className={styles.btnSecondary} onClick={onClose} disabled={busy}>{t(`${NS}.cancel`, "Cancel")}</button>
            <button type="submit" className={styles.btnPrimary} disabled={busy}>{busy ? t(`${NS}.creating`, "Creating…") : t(`${NS}.create`, "Create role")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
