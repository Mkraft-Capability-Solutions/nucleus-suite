"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Key, Puzzle, Terminal } from "lucide-react";
import { useResource } from "./admin/adminApi";
import { StateBox, useT } from "./admin/AdminParts";
import ApiKeyDialog from "./integrations/ApiKeyDialog";
import ApiTab from "./integrations/ApiTab";
import ConnectorsTab from "./integrations/ConnectorsTab";
import PartnerTab from "./integrations/PartnerTab";
import type { IntegrationsOverview } from "./integrations/types";
import styles from "./admin/Admin.module.css";

/**
 * Integrations (settings / admin page, rule 4.6): connector status, test, last sync and error log from
 * GET /api/v1/integrations/overview; sync/test are queued via POST .../connections/{id}/sync|test;
 * API keys via /api/v1/integrations/api-keys; partner data from platform tenants and tenant domains.
 */

const NS = "components.Workspace.IntegrationsView";
type Tab = "connectors" | "api" | "partner";

export default function IntegrationsView(_props: { onNavigate?: unknown; onSelectConsole?: unknown; activeSubFeature?: unknown }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("connectors");
  const [issuing, setIssuing] = useState(false);
  const [keysVersion, setKeysVersion] = useState(0);
  const { state, reload } = useResource<IntegrationsOverview>("/api/v1/integrations/overview", t(`${NS}.text_failed`, "Integrations could not be loaded."));
  const tabs: Array<[Tab, string, typeof Puzzle]> = [
    ["connectors", t(`${NS}.tab_connectors`, "Enterprise connectors"), Puzzle],
    ["api", t(`${NS}.tab_api`, "API & webhooks"), Terminal],
    ["partner", t(`${NS}.tab_partner`, "White-label partner channel"), Building2],
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{t(`${NS}.text_title`, "Integrations, API Platform & Partner Hub")}</h1>
          <p className={styles.subtitle}>{t(`${NS}.text_subtitle`, "Connector status and sync, webhooks, API keys and partner channel.")}</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.btnSecondary} href="/api-docs"><Terminal size={15} aria-hidden="true" />{t(`${NS}.text_api_reference`, "API reference")}</Link>
          <button type="button" className={styles.btnPrimary} onClick={() => setIssuing(true)}><Key size={15} aria-hidden="true" />{t(`${NS}.text_generate`, "Generate API key")}</button>
        </div>
      </header>
      <div className={styles.tabs} role="tablist" aria-label={t(`${NS}.text_sections`, "Integration sections")}>
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`} onClick={() => setTab(id)}>
            <Icon size={16} aria-hidden="true" />{label}
          </button>
        ))}
      </div>
      {state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>}
      {state.status === "error" && <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>}
      {state.status === "ready" && tab === "connectors" && <ConnectorsTab t={t} connections={state.data.connections} onChanged={reload} />}
      {state.status === "ready" && tab === "api" && <ApiTab t={t} overview={state.data} keysVersion={keysVersion} />}
      {state.status === "ready" && tab === "partner" && <PartnerTab t={t} overview={state.data} />}
      {issuing && <ApiKeyDialog t={t} onClose={() => setIssuing(false)} onIssued={() => setKeysVersion((value) => value + 1)} />}
    </div>
  );
}
