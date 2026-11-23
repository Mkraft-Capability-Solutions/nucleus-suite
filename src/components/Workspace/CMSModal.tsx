"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Megaphone, X } from "lucide-react";
import styles from "./CMSModal.module.css";
import { failureMessage, readJson, useT } from "./engagement-client";
import CMSAnnouncementsTab, { CMS_NS, type Announcement, type AnnouncementTypeOption } from "./CMSAnnouncementsTab";
import CMSPoliciesTab, { type PolicyDoc } from "./CMSPoliciesTab";

/**
 * Content studio shell. Loads the CMS announcement feed, the policy library and the audience contract
 * (announcement types and the departments real employees belong to), then renders the two tabs.
 */

const NS = CMS_NS;
type Tab = "announcements" | "policies";
type Toast = (title: string, message: string, tone: "success" | "error") => void;

type AnnouncementsEnvelope = { data: Announcement[]; meta: { canManage: boolean } };
type PoliciesEnvelope = { data: PolicyDoc[]; meta: { canManage: boolean; categories: string[]; maxBytes: number } };
type AudienceEnvelope = { data: { dimensions: { departments: string[] }; contract: { types: AnnouncementTypeOption[] } } };

type Loaded = {
  announcements: Announcement[];
  canManageAnnouncements: boolean;
  policies: PolicyDoc[];
  canManagePolicies: boolean;
  categories: string[];
  maxBytes: number;
  types: AnnouncementTypeOption[];
  departments: string[];
};
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: Loaded };

export default function CMSModal({ isOpen, onClose, showToast }: { isOpen: boolean; onClose: () => void; showToast?: (title: string, message: string, tone: string) => void }) {
  const { t } = useT();
  const [tab, setTab] = useState<Tab>("announcements");
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async (signal?: AbortSignal): Promise<State> => {
    const [ann, pol, aud] = await Promise.all([
      readJson<AnnouncementsEnvelope>("/api/v1/announcements?view=cms", signal),
      readJson<PoliciesEnvelope>("/api/v1/documents/policies", signal),
      readJson<AudienceEnvelope>("/api/v1/announcement-register?view=audience&rule=all", signal),
    ]);
    const failed = [ann, pol, aud].find((result) => !result.ok);
    if (failed) return { status: "error", message: failureMessage(failed, t, t(`${NS}.text_load_failed`, "Content could not be loaded.")) };
    return {
      status: "ready",
      data: {
        announcements: ann.body?.data ?? [],
        canManageAnnouncements: Boolean(ann.body?.meta?.canManage),
        policies: pol.body?.data ?? [],
        canManagePolicies: Boolean(pol.body?.meta?.canManage),
        categories: pol.body?.meta?.categories ?? [],
        maxBytes: pol.body?.meta?.maxBytes ?? 0,
        types: aud.body?.data?.contract?.types ?? [],
        departments: aud.body?.data?.dimensions?.departments ?? [],
      },
    };
  }, [t]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    load(controller.signal).then(setState).catch(() => undefined);
    return () => controller.abort();
  }, [isOpen, load]);

  const refresh = useCallback(async () => {
    setState(await load());
  }, [load]);

  const onToast: Toast = (title, message, tone) => showToast?.(title, message, tone);

  if (!isOpen) return null;
  const data = state.status === "ready" ? state.data : null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="cms-title" onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerIcon}><Megaphone size={20} aria-hidden="true" /></div>
            <div>
              <h3 id="cms-title">{t(`${NS}.CMSModal_text_2`, "Content studio")}</h3>
              <p>{t(`${NS}.CMSModal_text_3`, "Publish announcements and manage policy documents")}</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={t(`${NS}.CMSModal_title_4`, "Close")}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.tabBar} role="tablist">
          <button type="button" role="tab" aria-selected={tab === "announcements"} className={`${styles.tabBtn} ${tab === "announcements" ? styles.active : ""}`} onClick={() => setTab("announcements")}>
            <Megaphone size={16} aria-hidden="true" />
            {t(`${NS}.text_tab_announcements`, "Announcements ({count})", { count: data?.announcements.length ?? 0 })}
          </button>
          <button type="button" role="tab" aria-selected={tab === "policies"} className={`${styles.tabBtn} ${tab === "policies" ? styles.active : ""}`} onClick={() => setTab("policies")}>
            <FileText size={16} aria-hidden="true" />
            {t(`${NS}.text_tab_policies`, "Policies ({count})", { count: data?.policies.length ?? 0 })}
          </button>
        </div>

        <div className={styles.contentBody} role="tabpanel" aria-busy={state.status === "loading"}>
          {state.status === "loading" && <p className={styles.emptyText}>{t(`${NS}.text_loading`, "Loading content…")}</p>}
          {state.status === "error" && (
            <div role="alert">
              <p className={styles.formError}>{state.message}</p>
              <button type="button" className={styles.btnSecondary} onClick={() => { setState({ status: "loading" }); void refresh(); }}>
                {t(`${NS}.text_retry`, "Try again")}
              </button>
            </div>
          )}
          {data && tab === "announcements" && (
            <CMSAnnouncementsTab items={data.announcements} canManage={data.canManageAnnouncements} types={data.types} departments={data.departments} onChanged={refresh} onToast={onToast} />
          )}
          {data && tab === "policies" && (
            <CMSPoliciesTab items={data.policies} canManage={data.canManagePolicies} categories={data.categories} departments={data.departments} maxBytes={data.maxBytes} onChanged={refresh} onToast={onToast} />
          )}
        </div>
      </div>
    </div>
  );
}
