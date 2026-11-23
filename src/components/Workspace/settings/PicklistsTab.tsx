"use client";

import { useState } from "react";
import { List, Search } from "lucide-react";
import { useResource, type Translate } from "../admin/adminApi";
import { StateBox } from "../admin/AdminParts";
import styles from "../admin/Admin.module.css";

const NS = "components.Workspace.SettingsView";

type Picklist = { code: string; name: string; seededBy: string; values: string[] };

/** Master picklist catalog from GET /api/v1/system/picklists (system_configuration_values). */
export default function PicklistsTab({ t }: { t: Translate }) {
  const { state, reload } = useResource<{ picklists?: Picklist[] }>("/api/v1/system/picklists", t(`${NS}.text_picklists_failed`, "The picklist catalog could not be loaded."));
  const [query, setQuery] = useState("");
  const all = state.status === "ready" && Array.isArray(state.data.picklists) ? state.data.picklists : [];
  const needle = query.trim().toLowerCase();
  const rows = needle ? all.filter((pl) => `${pl.code} ${pl.name} ${pl.seededBy} ${pl.values.join(" ")}`.toLowerCase().includes(needle)) : all;
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon} aria-hidden="true"><List size={18} /></span>
          <div><h3 className={styles.cardTitle}>{t(`${NS}.text_picklists_title`, "System & config picklists catalog")}</h3><p className={styles.cardSubtitle}>{t(`${NS}.text_picklists_sub`, "Master dropdown catalogs and lookup value sets ({count}).", { count: all.length })}</p></div>
        </div>
        <label className={styles.search}><Search size={15} aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(`${NS}.placeholder_search_picklist`, "Search picklist code, name, value…")} aria-label={t(`${NS}.placeholder_search_picklist`, "Search picklist code, name, value…")} /></label>
      </div>
      {state.status === "loading" && <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading…")}</StateBox>}
      {state.status === "error" && <StateBox tone="error" onRetry={reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{state.message}</StateBox>}
      {state.status === "ready" && rows.length === 0 && <StateBox tone="empty">{all.length === 0 ? t(`${NS}.text_no_picklists`, "No picklists are loaded.") : t(`${NS}.text_no_match`, "Nothing matches your search.")}</StateBox>}
      {rows.length > 0 && (
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th scope="col">{t(`${NS}.text_picklist_code`, "Picklist code")}</th><th scope="col">{t(`${NS}.text_name`, "Name")}</th><th scope="col">{t(`${NS}.text_seeded_by`, "Seeded by")}</th><th scope="col">{t(`${NS}.text_values_count`, "Values")}</th><th scope="col">{t(`${NS}.text_value_set_preview`, "Value set preview")}</th></tr></thead>
          <tbody>{rows.map((pl) => (
            <tr key={pl.code}>
              <td className={styles.mono}>{pl.code}</td><td>{pl.name}</td>
              <td><span className={`${styles.badge} ${pl.seededBy === "System" ? styles.badgeInfo : styles.badgeAgent}`}>{pl.seededBy}</span></td>
              <td>{pl.values.length}</td>
              <td><div className={styles.chips}>{pl.values.slice(0, 5).map((value) => <span key={value} className={styles.badge}>{value}</span>)}{pl.values.length > 5 && <span className={styles.help}>{t(`${NS}.text_more_count`, "+{count} more", { count: pl.values.length - 5 })}</span>}</div></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}
