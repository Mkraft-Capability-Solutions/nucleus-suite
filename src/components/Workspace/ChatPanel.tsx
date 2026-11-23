"use client";

import { useEffect, useRef } from "react";
import { Hash, MessageSquare, Send, X } from "lucide-react";
import styles from "./ChatPanel.module.css";
import { useT } from "./engagement-client";

/**
 * Team messages panel (header Messages button).
 *
 * There is no messaging store in this workspace: no conversations, channels or direct-message table exists in
 * the schema, and the only per-person store (`notifications`) is the notification inbox, which must not double
 * as chat. Rather than show invented conversations, the panel keeps its frame (header, channel strip, history,
 * composer) and states plainly that messaging is not available. The composer is disabled, so nothing appears
 * to be sent that no one would ever receive.
 */

const NS = "components.Workspace.ChatPanel";

export default function ChatPanel({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const reason = t(`${NS}.text_unavailable_reason`, "Team messaging is not set up for this workspace yet, so there are no conversations to show and messages cannot be sent.");

  return (
    <div className={styles.floatingChatContainer} role="dialog" aria-labelledby="chat-panel-title" aria-describedby="chat-panel-reason">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.chatIconBadge} aria-hidden="true"><MessageSquare size={18} /></div>
          <div className={styles.titleBlock}>
            <strong id="chat-panel-title">{t(`${NS}.text_title`, "Team messages")}</strong>
            <span>{t(`${NS}.text_status_unavailable`, "Not available")}</span>
          </div>
        </div>
        <button ref={closeRef} type="button" className={styles.closeBtn} onClick={onClose} aria-label={t(`${NS}.text_close`, "Close messages")} title={t(`${NS}.text_close`, "Close messages")}>
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.channelStrip} aria-label={t(`${NS}.text_channels`, "Conversations")}>
        <span className={`${styles.channelTab} ${styles.channelDisabled}`}>
          <Hash size={13} aria-hidden="true" />
          <span>{t(`${NS}.text_no_channels`, "No conversations")}</span>
        </span>
      </div>

      <div className={styles.chatHistory}>
        <div className={styles.unavailable} role="status">
          <MessageSquare size={28} aria-hidden="true" />
          <strong>{t(`${NS}.text_unavailable_title`, "Messaging is not available")}</strong>
          <p id="chat-panel-reason">{reason}</p>
          <p className={styles.unavailableHint}>{t(`${NS}.text_unavailable_hint`, "For HR questions, raise a helpdesk ticket; announcements reach everyone through the company feed.")}</p>
        </div>
      </div>

      <form className={styles.inputArea} onSubmit={(event) => event.preventDefault()}>
        <label className={styles.srOnly} htmlFor="chat-panel-input">{t(`${NS}.text_message_label`, "Message")}</label>
        <input id="chat-panel-input" type="text" className={styles.chatInput} disabled placeholder={t(`${NS}.text_input_disabled`, "Messaging is not available")} title={reason} />
        <button type="submit" className={styles.sendBtn} disabled aria-label={t(`${NS}.text_send`, "Send message")} title={reason}>
          <Send size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
