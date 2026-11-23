"use client";

import { useState, type FormEvent } from "react";
import { Eye, Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import styles from "./CMSModal.module.css";
import { failureMessage, fieldErrors, formatDate, sendJson, useSubmitKey, useT } from "./engagement-client";

/**
 * Announcements tab of the CMS. The feed comes from GET /api/v1/announcements?view=cms; publishing posts the
 * same view with an Idempotency-Key; pin and remove go to /api/v1/announcements/{id}. Audience options are the
 * departments that real employees belong to (announcement-register audience view); announcement types come
 * from the same contract. Every change is shown only after the server accepts it.
 */

export const CMS_NS = "components.Workspace.CMSModal";
const NS = CMS_NS;

export type Announcement = { id: string; title: string; body: string; category: string; audience: string; pinned: boolean; authorName: string | null; createdAt: string; expiresAt: string | null };
export type AnnouncementTypeOption = { code: string; label: string };

type Draft = { title: string; body: string; category: string; audience: string; pinned: boolean };
type Errors = Partial<Record<keyof Draft, string>>;

export function audienceLabel(rule: string, t: ReturnType<typeof useT>["t"]): string {
  if (rule === "all") return t(`${NS}.text_audience_all`, "All employees");
  return rule.replace(/^department:/, "");
}

export default function CMSAnnouncementsTab({ items, canManage, types, departments, onChanged, onToast }: {
  items: Announcement[];
  canManage: boolean;
  types: AnnouncementTypeOption[];
  departments: string[];
  onChanged: () => Promise<void>;
  onToast: (title: string, message: string, tone: "success" | "error") => void;
}) {
  const { t, locale } = useT();
  const [draft, setDraft] = useState<Draft>({ title: "", body: "", category: types[0]?.code ?? "general", audience: "all", pinned: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { keyFor, reset } = useSubmitKey();
  const typeLabel = (code: string) => t(`${NS}.type_${code}`, types.find((entry) => entry.code === code)?.label ?? code);

  const validate = (value: Draft): Errors => {
    const found: Errors = {};
    if (value.title.trim().length < 3) found.title = t(`${NS}.err_title`, "Enter a title of at least 3 characters.");
    if (!value.body.trim()) found.body = t(`${NS}.err_body`, "Write the announcement content.");
    if (value.body.trim().length > 5000) found.body = t(`${NS}.err_body_long`, "Keep the content under 5000 characters.");
    if (!value.category) found.category = t(`${NS}.err_category`, "Choose an announcement type.");
    return found;
  };

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(draft);
    setErrors(found);
    const first = (Object.keys(found) as Array<keyof Draft>)[0];
    if (first) {
      document.getElementById(`cms-ann-${first}`)?.focus();
      return;
    }
    const payload = { title: draft.title.trim(), body: draft.body.trim(), category: draft.category, audience: draft.audience, pinned: draft.pinned };
    setBusy("publish");
    setFormError(null);
    const result = await sendJson("POST", "/api/v1/announcements?view=cms", payload, { idempotencyKey: keyFor(payload) });
    setBusy(null);
    if (!result.ok) {
      setErrors(fieldErrors(result.details) as Errors);
      setFormError(failureMessage(result, t, t(`${NS}.text_publish_failed`, "The announcement could not be published.")));
      return;
    }
    reset();
    setDraft({ ...draft, title: "", body: "", pinned: false });
    onToast(t(`${NS}.text_published_title`, "Announcement published"), t(`${NS}.text_published_body`, "{title} is live.", { title: payload.title }), "success");
    await onChanged();
  };

  const act = async (item: Announcement, kind: "pin" | "remove") => {
    if (kind === "remove" && !window.confirm(t(`${NS}.text_remove_confirm`, "Remove “{title}” from the feed?", { title: item.title }))) return;
    setBusy(item.id);
    const result = kind === "pin"
      ? await sendJson("PATCH", `/api/v1/announcements/${encodeURIComponent(item.id)}`, { pinned: !item.pinned })
      : await sendJson("DELETE", `/api/v1/announcements/${encodeURIComponent(item.id)}`, undefined);
    setBusy(null);
    if (!result.ok) {
      onToast(t(`${NS}.text_action_failed`, "The change was not saved"), failureMessage(result, t, t(`${NS}.text_action_failed`, "The change was not saved")), "error");
      return;
    }
    await onChanged();
  };

  const err = (field: keyof Draft) => errors[field] && <span id={`cms-ann-${field}-error`} className={styles.fieldError} role="alert">{errors[field]}</span>;

  return (
    <>
      {canManage ? (
        <form onSubmit={publish} className={styles.stack} noValidate>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-ann-title">{t(`${NS}.text_notice_title`, "Title")} *</label>
              <input id="cms-ann-title" className={styles.input} value={draft.title} maxLength={200} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-required="true" aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "cms-ann-title-error" : undefined} placeholder={t(`${NS}.text_title_placeholder`, "For example: Quarterly town hall")} />
              {err("title")}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-ann-category">{t(`${NS}.text_type`, "Type")} *</label>
              <select id="cms-ann-category" className={styles.select} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} aria-required="true">
                {types.map((entry) => <option key={entry.code} value={entry.code}>{typeLabel(entry.code)}</option>)}
              </select>
              {err("category")}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="cms-ann-audience">{t(`${NS}.text_audience`, "Audience")} *</label>
              <select id="cms-ann-audience" className={styles.select} value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })} aria-required="true">
                <option value="all">{t(`${NS}.text_audience_all`, "All employees")}</option>
                {departments.map((name) => <option key={name} value={`department:${name}`}>{name}</option>)}
              </select>
              {err("audience")}
            </div>
            <div className={styles.formGroup}>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={draft.pinned} onChange={(event) => setDraft({ ...draft, pinned: event.target.checked })} />
                <span>{t(`${NS}.text_pin_label`, "Pin to the top of the feed")}</span>
              </label>
            </div>
            <div className={`${styles.formGroup} ${styles.fullWidth ?? ""}`}>
              <label className={styles.label} htmlFor="cms-ann-body">{t(`${NS}.text_content`, "Content")} *</label>
              <textarea id="cms-ann-body" className={styles.textarea} value={draft.body} maxLength={5000} onChange={(event) => setDraft({ ...draft, body: event.target.value })} aria-required="true" aria-invalid={Boolean(errors.body)} aria-describedby={errors.body ? "cms-ann-body-error" : undefined} placeholder={t(`${NS}.text_content_placeholder`, "Details, agenda, links or actions for employees")} />
              {err("body")}
            </div>
          </div>
          {draft.title && (
            <div className={styles.previewBox}>
              <div className={styles.previewHeader}>
                <span className={styles.previewBadge}>{draft.pinned ? t(`${NS}.text_pinned`, "Pinned") : typeLabel(draft.category)}</span>
                <span className={styles.previewMeta}>{t(`${NS}.text_audience_meta`, "Audience: {audience}", { audience: audienceLabel(draft.audience, t) })}</span>
              </div>
              <h4 className={styles.previewTitle}>{draft.title}</h4>
              <p className={styles.previewContent}>{draft.body || t(`${NS}.text_preview_empty`, "The content will preview here.")}</p>
            </div>
          )}
          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          <div className={styles.actionsEnd}>
            <button type="submit" className={styles.btnPrimary} disabled={busy === "publish"}>
              <Plus size={16} aria-hidden="true" />{busy === "publish" ? t(`${NS}.text_publishing`, "Publishing…") : t(`${NS}.text_publish`, "Publish announcement")}
            </button>
          </div>
        </form>
      ) : (
        <p className={styles.note}>{t(`${NS}.text_read_only`, "You can read announcements; publishing needs the employee write permission.")}</p>
      )}

      <div className={styles.sectionDivider}>
        <h4 className={styles.existingTitle}><Eye size={16} aria-hidden="true" />{t(`${NS}.text_live_count`, "Live announcements ({count})", { count: items.length })}</h4>
        {items.length === 0 && <p className={styles.note}>{t(`${NS}.text_no_announcements`, "No announcements are live.")}</p>}
        <div className={styles.itemsList}>
          {items.map((item) => (
            <div key={item.id} className={styles.listItem}>
              <div className={styles.itemLeft}>
                {item.pinned ? <Pin size={18} className={styles.pinOn} aria-label={t(`${NS}.text_pinned`, "Pinned")} /> : <Megaphone size={18} className={styles.pinOff} aria-hidden="true" />}
                <div className={styles.itemInfo}>
                  <h4>{item.title}</h4>
                  <p>{t(`${NS}.text_item_meta`, "{type} · {audience} · Posted {date}", { type: typeLabel(item.category), audience: audienceLabel(item.audience, t), date: formatDate(item.createdAt, locale) })}{item.authorName ? ` · ${item.authorName}` : ""}</p>
                </div>
              </div>
              {canManage && (
                <div className={styles.itemActions}>
                  <button type="button" className={styles.actionIconBtn} onClick={() => void act(item, "pin")} disabled={busy === item.id} aria-label={item.pinned ? t(`${NS}.text_unpin`, "Unpin") : t(`${NS}.text_pin`, "Pin to top")} title={item.pinned ? t(`${NS}.text_unpin`, "Unpin") : t(`${NS}.text_pin`, "Pin to top")}>
                    <Pin size={16} className={item.pinned ? styles.pinOn : styles.pinOff} aria-hidden="true" />
                  </button>
                  <button type="button" className={`${styles.actionIconBtn} ${styles.delete ?? ""}`} onClick={() => void act(item, "remove")} disabled={busy === item.id} aria-label={t(`${NS}.text_remove`, "Remove announcement")} title={t(`${NS}.text_remove`, "Remove announcement")}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
