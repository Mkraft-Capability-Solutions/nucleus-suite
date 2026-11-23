"use client";

import { Building2, Globe } from "lucide-react";
import { useResource, type Translate } from "../admin/adminApi";
import { StateBox } from "../admin/AdminParts";
import type { IntegrationsOverview } from "./types";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.IntegrationsView";

/** Managed tenants come from the platform-admin API (platform admins only); domains from tenant_domains. Rev-share has no data source. */
export default function PartnerTab({ t, overview }: { t: Translate; overview: IntegrationsOverview }) {
  const tenants = useResource<Array<{ id: string; member_count: number }>>("/api/v1/platform/tenants", t(`${NS}.text_tenants_failed`, "Managed tenants are visible to platform administrators only."));
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}><Building2 size={18} aria-hidden="true" />{t(`${NS}.text_partner_title`, "White-label partner & multi-tenant hub")}</h3>
        <span className={styles.badge} title={t(`${NS}.text_revshare_reason`, "No partner agreement is recorded for this organisation.")}>{t(`${NS}.text_revshare_unavailable`, "Revenue share: not available")}</span>
      </div>
      <p className={styles.cardSubtitle}>{t(`${NS}.text_partner_desc`, "Custom-branded instances for client organisations, managed from a single plane.")}</p>
      <div className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <span>
            <span className={styles.kpiLabel}>{t(`${NS}.text_managed_tenants`, "Managed tenants")}</span>
            {tenants.state.status === "ready" ? (
              <>
                <span className={styles.kpiValue}>{tenants.state.data.length}</span>
                <span className={styles.help}>{t(`${NS}.text_seats`, "{count} member seats", { count: tenants.state.data.reduce((sum, row) => sum + Number(row.member_count ?? 0), 0) })}</span>
              </>
            ) : tenants.state.status === "loading" ? <span className={styles.kpiMuted}>{t(`${NS}.text_loading`, "Loading…")}</span>
              : <span className={styles.kpiMuted} title={tenants.state.message}>{t(`${NS}.text_not_available`, "Not available")} · {tenants.state.message}</span>}
          </span>
        </div>
        <div className={styles.kpi}>
          <span>
            <span className={styles.kpiLabel}><Globe size={12} aria-hidden="true" /> {t(`${NS}.text_domains`, "Custom domains & SSL")}</span>
            {overview.domains.length === 0 ? <StateBox tone="empty">{t(`${NS}.text_no_domains`, "No custom domain is registered.")}</StateBox> : overview.domains.map((domain) => (
              <span key={domain.id} className={styles.help}>
                <span className={styles.mono}>{domain.domain ?? "—"}</span>{" "}
                <span className={`${styles.badge} ${domain.verified ? styles.badgeOk : styles.badgeWarn}`}>{domain.verified ? t(`${NS}.text_verified`, "Verified") : t(`${NS}.text_unverified`, "Not verified")}</span>
              </span>
            ))}
          </span>
        </div>
      </div>
    </section>
  );
}
