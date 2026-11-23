"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ThumbsUp } from "lucide-react";
import styles from "./ExperienceView.module.css";
import { failureMessage, fieldErrors, formatDateTime, readJson, sendJson, useSubmitKey, useT } from "./engagement-client";
import { EXP_NS, type EmployeeOption, type FeedPost, type Loadable, type Recognition } from "./experience-model";

const NS = EXP_NS;

/** Kudos form (recipient picked from real employees), the recognition feed with one like per person, and the feed posts. */
export default function ExperienceSocialTab({ feed, recognitions, onChanged, onToast }: {
  feed: Loadable<FeedPost[]>;
  recognitions: Loadable<Recognition[]>;
  onChanged: () => Promise<void>;
  onToast: (title: string, message: string, tone: "success" | "error") => void;
}) {
  const { t, locale } = useT();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const { keyFor, reset } = useSubmitKey();

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      readJson<{ data: EmployeeOption[] }>(`/api/v1/dossier-lookups/employees?search=${encodeURIComponent(search)}&pageSize=20`, controller.signal)
        .then((result) => setOptions(result.ok ? result.body?.data ?? [] : []))
        .catch(() => undefined);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!recipient) found.recipientEmployeeId = t(`${NS}.err_recipient`, "Choose who you are recognising.");
    if (!message.trim()) found.message = t(`${NS}.err_message`, "Write a short message.");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    const payload = { recipientEmployeeId: recipient, message: message.trim() };
    setBusy(true);
    const result = await sendJson("POST", "/api/v1/recognition-events", payload, { idempotencyKey: keyFor(payload) });
    setBusy(false);
    if (!result.ok) {
      setErrors(fieldErrors(result.details));
      return onToast(t(`${NS}.text_kudos_failed`, "Kudos not sent"), failureMessage(result, t, t(`${NS}.text_try_again`, "Try again.")), "error");
    }
    reset();
    setMessage("");
    onToast(t(`${NS}.text_kudos_sent`, "Kudos sent"), t(`${NS}.text_kudos_sent_body`, "Your recognition is on the wall."), "success");
    await onChanged();
  };

  const toggleLike = async (item: Recognition) => {
    const result = await sendJson("POST", `/api/v1/recognition-events/${item.id}/like`, { op: item.likedByViewer ? "withdraw" : "like" });
    if (!result.ok) return onToast(t(`${NS}.text_like_failed`, "Could not update the like"), failureMessage(result, t, t(`${NS}.text_try_again`, "Try again.")), "error");
    await onChanged();
  };

  return (
    <div className={styles.container}>
      <form className={styles.card} onSubmit={submit} aria-labelledby="kudos-heading" noValidate>
        <h3 id="kudos-heading">{t(`${NS}.text_kudos_title`, "Recognise a colleague")}</h3>
        <label htmlFor="kudos-search">{t(`${NS}.text_find_colleague`, "Find a colleague")}</label>
        <input id="kudos-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label htmlFor="kudos-recipient">{t(`${NS}.text_recipient`, "Colleague")} *</label>
        <select id="kudos-recipient" value={recipient} aria-required="true" aria-invalid={Boolean(errors.recipientEmployeeId)} aria-describedby={errors.recipientEmployeeId ? "kudos-recipient-error" : undefined} onChange={(event) => setRecipient(event.target.value)}>
          <option value="">{t(`${NS}.text_choose`, "Choose…")}</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        {errors.recipientEmployeeId && <p id="kudos-recipient-error" role="alert">{errors.recipientEmployeeId}</p>}
        <label htmlFor="kudos-message">{t(`${NS}.text_message`, "Message")} *</label>
        <textarea id="kudos-message" value={message} maxLength={1000} aria-required="true" aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? "kudos-message-error" : undefined} onChange={(event) => setMessage(event.target.value)} />
        {errors.message && <p id="kudos-message-error" role="alert">{errors.message}</p>}
        <button type="submit" className={styles.btnPrimary} disabled={busy}>{t(`${NS}.text_send_kudos`, "Send kudos")}</button>
      </form>

      <section className={styles.feedGrid} aria-label={t(`${NS}.text_recognitions`, "Recognitions")} aria-live="polite">
        {recognitions.status === "loading" && <p aria-busy="true">{t(`${NS}.text_loading`, "Loading…")}</p>}
        {recognitions.status === "error" && <p role="alert">{recognitions.message}</p>}
        {recognitions.status === "ready" && recognitions.data.length === 0 && <p>{t(`${NS}.text_no_recognitions`, "No recognitions yet.")}</p>}
        {recognitions.status === "ready" && recognitions.data.map((item) => (
          <article key={item.id} className={styles.feedCard}>
            <strong>{t(`${NS}.text_recognised`, "{from} recognised {to}", { from: item.nominator.name ?? t(`${NS}.text_someone`, "A colleague"), to: item.recipient.name })}</strong>
            <p>{item.message}</p>
            <small>{formatDateTime(item.createdAt, locale)}</small>
            <button type="button" className={styles.btnSecondary} aria-pressed={item.likedByViewer} onClick={() => toggleLike(item)}>
              <ThumbsUp size={14} aria-hidden="true" /> {t(`${NS}.text_likes`, "{count, plural, one {# like} other {# likes}}", { count: item.likeCount })}
            </button>
          </article>
        ))}
      </section>

      <section className={styles.feedGrid} aria-label={t(`${NS}.text_feed`, "Company feed")}>
        {feed.status === "loading" && <p aria-busy="true">{t(`${NS}.text_loading`, "Loading…")}</p>}
        {feed.status === "error" && <p role="alert">{feed.message}</p>}
        {feed.status === "ready" && feed.data.length === 0 && <p>{t(`${NS}.text_no_posts`, "No posts yet.")}</p>}
        {feed.status === "ready" && feed.data.map((post) => (
          <article key={post.id} className={styles.feedCard}>
            <span className={styles.avatar} aria-hidden="true">{post.authorInitials}</span>
            <strong>{post.title}</strong> · {post.authorName}
            <p>{post.body}</p>
            <small>{formatDateTime(post.createdAt, locale)}</small>
          </article>
        ))}
      </section>
    </div>
  );
}
