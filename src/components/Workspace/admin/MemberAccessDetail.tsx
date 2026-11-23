"use client";

import { useId, useState } from "react";
import { Building2, Eye, EyeOff, RotateCcw, Unlock, UserMinus } from "lucide-react";
import { UI_CARD_KEYS, UI_PAGE_KEYS, type EffectiveEntry, type UiResourceType } from "@/lib/access/ui-access-catalog";
import { daysAhead, formatDate, send, useResource, useSubmitKey, type MemberAccess } from "./adminApi";
import { Notice, StateBox, Switch, useT, useToast } from "./AdminParts";
import { AccessSummary } from "./RolePreview";
import { cardName, pageName, sourceLabel } from "./uiLabels";
import { useTranslation } from "@/context/I18nContext";
import styles from "./Admin.module.css";

const NS = "components.Workspace.MemberAccessDetail";

type Item = { type: UiResourceType; key: string; effect: "allow" | "deny" };

/** Mirrors setOverridesSchema / clearOverridesSchema in src/server/access/member-access.ts. */
function validateChange(reason: string, expiresOn: string, today: string, max: string): { reason?: string; expiresOn?: string } {
  const errors: { reason?: string; expiresOn?: string } = {};
  if (reason.trim().length < 3) errors.reason = "reason";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || expiresOn <= today || expiresOn > max) errors.expiresOn = "expiry";
  return errors;
}

export default function MemberAccessDetail({ memberId, onChanged }: { memberId: string; onChanged: () => void }) {
  const t = useT();
  const toast = useToast();
  const { locale } = useTranslation();
  const formId = useId();
  const submitKey = useSubmitKey();
  const { state, reload } = useResource<MemberAccess>(`/api/v1/access/members/${encodeURIComponent(memberId)}`, t(`${NS}.text_failed`, "This member's access could not be loaded."));
  const [reason, setReason] = useState("");
  const [expiresOn, setExpiresOn] = useState(daysAhead(90));
  const [errors, setErrors] = useState<{ reason?: string; expiresOn?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  if (state.status === "loading") return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading access…")}</StateBox>;
  if (state.status === "error") return <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>;
  const detail = state.data;
  const { member } = detail;

  const checkForm = (needsExpiry: boolean) => {
    const found = validateChange(reason, needsExpiry ? expiresOn : daysAhead(1), daysAhead(0), daysAhead(366));
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const finish = (message: string) => {
    submitKey.done();
    toast(t(`${NS}.toast_title`, "Access updated"), message, "success");
    reload();
    onChanged();
  };

  const setOverrides = async (items: Item[], message: string) => {
    if (busy || !checkForm(true)) return;
    const body = { items, reason: reason.trim(), expiresOn };
    setBusy(true);
    setError(null);
    const result = await send<MemberAccess>(`/api/v1/access/members/${member.id}/overrides`, {
      method: "POST", body, idempotencyKey: submitKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_save_failed`, "The change could not be saved."),
    });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    finish(message);
  };

  const clearOverrides = async (items: Array<{ type: UiResourceType; key: string }> | undefined, message: string) => {
    if (busy || !checkForm(false)) return;
    setBusy(true);
    setError(null);
    const result = await send<MemberAccess>(`/api/v1/access/members/${member.id}/overrides`, {
      method: "DELETE", body: { ...(items ? { items } : {}), reason: reason.trim() }, fallback: t(`${NS}.text_save_failed`, "The change could not be saved."),
    });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    finish(message);
  };

  const all = (effect: "allow" | "deny"): Item[] => [
    ...UI_PAGE_KEYS.filter((key) => effect === "allow" || key !== "settings").map((key) => ({ type: "page" as const, key, effect })),
    ...UI_CARD_KEYS.map((key) => ({ type: "card" as const, key, effect })),
  ];

  const row = (type: UiResourceType, entry: EffectiveEntry) => {
    const name = type === "page" ? pageName(t, entry.key) : cardName(t, entry.key);
    const override = detail.overrides.find((item) => item.type === type && item.key === entry.key);
    return (
      <div key={`${type}-${entry.key}`} className={`${styles.item} ${entry.visible ? styles.itemOn : ""}`}>
        <span className={styles.itemText}>
          <span className={styles.itemTitle}>{name}</span>
          <span className={styles.itemDesc}>
            {sourceLabel(t, entry.source)}
            {override ? ` · ${t(`${NS}.text_until`, "until {date}", { date: formatDate(override.expiresAt, locale) })}` : ""}
          </span>
          {override && (
            <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => void clearOverrides([{ type, key: entry.key }], t(`${NS}.toast_reverted`, "{item} follows the role again for {name}.", { item: name, name: member.name }))}>
              <RotateCcw size={12} aria-hidden="true" />{t(`${NS}.text_revert`, "Use role setting")}
            </button>
          )}
        </span>
        <Switch
          checked={entry.visible}
          disabled={busy || detail.superAdmin}
          label={name}
          onChange={(next) => void setOverrides([{ type, key: entry.key, effect: next ? "allow" : "deny" }], next
            ? t(`${NS}.toast_granted`, "{item} granted to {name}.", { item: name, name: member.name })
            : t(`${NS}.toast_blocked`, "{item} blocked for {name}.", { item: name, name: member.name }))}
        />
      </div>
    );
  };

  return (
    <>
      <div className={styles.cardHeader}>
        <div className={styles.row}>
          <span className={styles.avatar} aria-hidden="true">{(member.name || member.email || "").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
          <div>
            <h3 className={styles.cardTitle}>{member.name || member.email}</h3>
            <p className={styles.cardSubtitle}>
              {[member.email, member.department, member.employeeCode].filter(Boolean).join(" · ")}
            </p>
            <div className={styles.chips}>
              {detail.roles.length === 0 && <span className={`${styles.badge} ${styles.badgeWarn}`}>{t(`${NS}.text_no_role`, "No active role")}</span>}
              {detail.roles.map((role) => <span key={role.id} className={`${styles.badge} ${styles.badgeInfo}`}>{role.name}</span>)}
              {detail.overrides.length > 0 && <span className={`${styles.badge} ${styles.badgeWarn}`}>{t(`${NS}.text_override_count`, "{count} overrides", { count: detail.overrides.length })}</span>}
            </div>
          </div>
        </div>
        <div className={styles.row}>
          <button type="button" className={styles.btnSecondary} onClick={() => setPreview((value) => !value)} aria-pressed={preview}>
            {preview ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            {preview ? t(`${NS}.text_hide_preview`, "Hide preview") : t(`${NS}.text_preview`, "Preview what they see")}
          </button>
        </div>
      </div>

      {detail.superAdmin && <Notice tone="info">{t(`${NS}.text_super`, "This member is a super admin and always has full access.")}</Notice>}

      {preview && <AccessSummary t={t} access={detail.access} permissions={detail.permissions} />}

      <fieldset className={styles.formGrid} disabled={busy || detail.superAdmin}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${formId}-reason`}>{t(`${NS}.text_reason`, "Reason for the change")}<span className={styles.required} aria-hidden="true">*</span></label>
          <input id={`${formId}-reason`} className={`${styles.input} ${errors.reason ? styles.inputInvalid : ""}`} value={reason} maxLength={500}
            aria-required="true" aria-invalid={Boolean(errors.reason)} aria-describedby={`${formId}-reason-help`} onChange={(event) => setReason(event.target.value)} />
          <span id={`${formId}-reason-help`} className={errors.reason ? styles.fieldError : styles.help}>
            {errors.reason ? t(`${NS}.err_reason`, "Give a reason of at least 3 characters.") : t(`${NS}.help_reason`, "Recorded in the audit trail with every change.")}
          </span>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${formId}-expiry`}>{t(`${NS}.text_expiry`, "Overrides expire on")}<span className={styles.required} aria-hidden="true">*</span></label>
          <input id={`${formId}-expiry`} type="date" className={`${styles.input} ${errors.expiresOn ? styles.inputInvalid : ""}`} value={expiresOn} min={daysAhead(1)} max={daysAhead(366)}
            aria-required="true" aria-invalid={Boolean(errors.expiresOn)} aria-describedby={`${formId}-expiry-help`} onChange={(event) => setExpiresOn(event.target.value)} />
          <span id={`${formId}-expiry-help`} className={errors.expiresOn ? styles.fieldError : styles.help}>
            {errors.expiresOn ? t(`${NS}.err_expiry`, "Choose a future date within one year.") : t(`${NS}.help_expiry`, "After this date the member falls back to their roles.")}
          </span>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${formId}-scope`}><Building2 size={13} aria-hidden="true" /> {t(`${NS}.text_scope`, "Record data scope")}</label>
          <select id={`${formId}-scope`} className={styles.select} disabled value="roles">
            <option value="roles">{t(`${NS}.text_scope_roles`, "Set by the member's role scopes")}</option>
          </select>
          <span className={styles.help}>{t(`${NS}.help_scope`, "Record-level scope (organisation, department, team, self) comes from scoped role grants in Access Scopes; it is not set per person here.")}</span>
        </div>
      </fieldset>

      <div className={styles.row}>
        <button type="button" className={styles.btnPrimary} disabled={busy || detail.superAdmin} onClick={() => void setOverrides(all("allow"), t(`${NS}.toast_all`, "All pages and cards granted to {name}.", { name: member.name }))}>
          <Unlock size={15} aria-hidden="true" />{t(`${NS}.text_grant_all`, "Grant all pages and cards")}
        </button>
        <button type="button" className={styles.btnSecondary} disabled={busy || detail.superAdmin} onClick={() => void setOverrides(all("deny"), t(`${NS}.toast_restricted`, "{name} is restricted to self-service settings.", { name: member.name }))}>
          <UserMinus size={15} aria-hidden="true" />{t(`${NS}.text_restrict`, "Restrict to self-service")}
        </button>
        {detail.overrides.length > 0 && (
          <button type="button" className={styles.btnDanger} disabled={busy} onClick={() => void clearOverrides(undefined, t(`${NS}.toast_reset`, "{name} follows their roles again.", { name: member.name }))}>
            <RotateCcw size={15} aria-hidden="true" />{t(`${NS}.text_reset`, "Remove all overrides")}
          </button>
        )}
      </div>

      {error && <Notice tone="error">{error}</Notice>}

      <h4 className={styles.groupTitle}>{t(`${NS}.text_pages`, "Pages")}</h4>
      <div className={styles.itemGrid}>{detail.access.pages.map((entry) => row("page", entry))}</div>
      <h4 className={styles.groupTitle}>{t(`${NS}.text_cards`, "Dashboard cards")}</h4>
      <div className={styles.itemGrid}>{detail.access.cards.map((entry) => row("card", entry))}</div>
    </>
  );
}
