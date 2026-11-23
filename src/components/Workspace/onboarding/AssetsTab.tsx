"use client";

import { useState } from "react";
import { Laptop, Plus } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "../OnboardingView.module.css";
import type { Translate } from "./api";
import { picklistText } from "./picklistOptions";
import StateNote from "./StateNote";
import AssetReturnDialog from "./AssetReturnDialog";
import type { ResourceState } from "./useResource";

/** Asset register rows from GET /api/v1/assets/register (asset_catalog + live custody). */
export type AssetRow = {
  id: string;
  asset_code: string;
  asset_type: string;
  description: string;
  serial: string;
  holder_code: string | null;
  holder_name: string | null;
  condition: string | null;
  issued_on: string | null;
  status: "available" | "allocated" | "returned" | "written_off";
};

const NS = "components.Workspace.OnboardingView";

const STATUS: Record<AssetRow["status"], { key: string; fallback: string; tone: string }> = {
  available: { key: "asset_status_available", fallback: "Available", tone: styles.badgeInfo },
  allocated: { key: "asset_status_allocated", fallback: "Allocated", tone: styles.badgeSuccess },
  returned: { key: "asset_status_returned", fallback: "Returned", tone: styles.badgePurple },
  written_off: { key: "asset_status_written_off", fallback: "Written off", tone: styles.badgeDanger },
};

export default function AssetsTab({ state, onReload, onAllocate, formatDate }: {
  state: ResourceState<AssetRow[]>;
  onReload: () => void;
  onAllocate: () => void;
  formatDate: (iso: string | null) => string;
}) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const [returning, setReturning] = useState<AssetRow | null>(null);

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.cardAccent}`}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}><Laptop size={20} aria-hidden="true" />{t(`${NS}.assets_title`, "Hardware asset register")}</h3>
            <p className={styles.cardSub}>{t(`${NS}.assets_subtitle`, "Every catalogued asset with its current holder. Allocation and return are audited and feed exit clearance.")}</p>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={onAllocate}><Plus size={15} aria-hidden="true" />{t(`${NS}.assets_register`, "Register and allocate asset")}</button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="onboarding-assets-table">
        <div className={styles.cardHead}>
          <h3 id="onboarding-assets-table" className={styles.cardTitleSm}>{t(`${NS}.assets_table_title`, "Catalogued assets")}</h3>
          {state.status === "ready" && <span className={styles.muted}>{t(`${NS}.assets_count`, "{count} assets", { count: state.data.length })}</span>}
        </div>
        {state.status === "loading" && <StateNote tone="loading">{t(`${NS}.assets_loading`, "Loading the asset register…")}</StateNote>}
        {state.status === "error" && <StateNote tone="error" onRetry={onReload} retryLabel={t(`${NS}.retry`, "Try again")}>{state.message}</StateNote>}
        {state.status === "ready" && state.data.length === 0 && <StateNote tone="empty">{t(`${NS}.assets_empty`, "No assets are catalogued yet. Register the first one to allocate it.")}</StateNote>}
        {state.status === "ready" && state.data.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t(`${NS}.col_asset_tag`, "Asset tag")}</th>
                  <th scope="col">{t(`${NS}.col_asset`, "Asset")}</th>
                  <th scope="col">{t(`${NS}.col_serial`, "Serial number")}</th>
                  <th scope="col">{t(`${NS}.col_holder`, "Assigned to")}</th>
                  <th scope="col">{t(`${NS}.col_issued`, "Issued on")}</th>
                  <th scope="col">{t(`${NS}.col_status`, "Status")}</th>
                  <th scope="col">{t(`${NS}.col_action`, "Action")}</th>
                </tr>
              </thead>
              <tbody>
                {state.data.map((asset) => {
                  const status = STATUS[asset.status] ?? STATUS.available;
                  return (
                    <tr key={asset.id}>
                      <td className={styles.mono}>{asset.asset_code}</td>
                      <td>
                        <div>{asset.description || "—"}</div>
                        <div className={styles.muted}>{picklistText("PL_ASSET_TYPE", asset.asset_type, t)}</div>
                      </td>
                      <td>{asset.serial ? <code className={styles.code}>{asset.serial}</code> : "—"}</td>
                      <td>
                        {asset.holder_name ? <strong>{asset.holder_name}</strong> : <span className={styles.muted}>{t(`${NS}.unassigned`, "Not assigned")}</span>}
                        {asset.holder_code && <div className={styles.muted}>{asset.holder_code}</div>}
                      </td>
                      <td>{formatDate(asset.issued_on)}</td>
                      <td><span className={`${styles.badge} ${status.tone}`}>{t(`${NS}.${status.key}`, status.fallback)}</span></td>
                      <td>
                        {asset.status === "allocated" ? (
                          <button type="button" className={`${styles.btnSecondary} ${styles.btnSmall}`} onClick={() => setReturning(asset)}>
                            {t(`${NS}.asset_return`, "Record return")}
                          </button>
                        ) : (
                          <span className={styles.muted}>{t(`${NS}.asset_no_action`, "In store")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AssetReturnDialog asset={returning} onClose={() => setReturning(null)} onReturned={() => { setReturning(null); onReload(); }} />
    </div>
  );
}
