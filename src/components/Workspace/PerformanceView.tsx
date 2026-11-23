"use client";

import { useState, type ReactNode } from "react";
import TrackChangesOutlined from "@mui/icons-material/TrackChangesOutlined";
import GridViewOutlined from "@mui/icons-material/GridViewOutlined";
import AutoAwesomeOutlined from "@mui/icons-material/AutoAwesomeOutlined";
import ReportProblemOutlined from "@mui/icons-material/ReportProblemOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import ChatBubbleOutlineOutlined from "@mui/icons-material/ChatBubbleOutlineOutlined";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { useTranslation } from "@/context/I18nContext";
import { launchAction } from "@/lib/action-launcher";
import OkrSection from "./performance-view/OkrSection";
import NineBoxSection from "./performance-view/NineBoxSection";
import { NS } from "./performance-view/parts";
import styles from "./PerformanceView.module.css";

type Section = "okrs" | "ninebox" | "coach" | "succession";
type Props = { onNavigate?: (tab: string, sub?: string, consoleId?: string) => void; onSelectConsole?: (id: string) => void };

const TABS: Array<{ id: Section; key: string; fallback: string; icon: ReactNode }> = [
  { id: "okrs", key: "tab_okrs", fallback: "OKRs", icon: <TrackChangesOutlined sx={{ fontSize: 16 }} /> },
  { id: "ninebox", key: "tab_ninebox", fallback: "9-box", icon: <GridViewOutlined sx={{ fontSize: 16 }} /> },
  { id: "coach", key: "tab_coach", fallback: "AI manager coach", icon: <AutoAwesomeOutlined sx={{ fontSize: 16 }} /> },
  { id: "succession", key: "tab_succession", fallback: "Succession risk", icon: <ReportProblemOutlined sx={{ fontSize: 16 }} /> },
];

export default function PerformanceView({ onNavigate, onSelectConsole }: Props) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("okrs");

  return (
    <div className={styles.perfContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.title`, "Performance & talent")}</h2>
          <p>{t(`${NS}.subtitle`, "Cascading OKRs, 9-box calibration, coaching and succession.")}</p>
        </div>
        <div className={styles.actions}>
          {(onNavigate || onSelectConsole) && (
            <button
              type="button"
              className={styles.btnAccent}
              onClick={() => {
                onSelectConsole?.("S6");
                onNavigate?.("dashboard", "dashboard", "s6");
              }}
            >
              <TrendingUpOutlined sx={{ fontSize: 15 }} />
              {t(`${NS}.calibration_console`, "Calibration console")}
            </button>
          )}
          <button type="button" className={styles.btnSecondary} onClick={() => launchAction("feedback360")}>
            <ChatBubbleOutlineOutlined sx={{ fontSize: 16 }} />
            {t(`${NS}.feedback360`, "Request 360 feedback")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => launchAction("okr")}>
            <AddOutlined sx={{ fontSize: 16 }} />
            {t(`${NS}.add_okr`, "Add objective")}
          </button>
        </div>
      </div>

      <div className={styles.tabNav} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            className={`${styles.tabBtn} ${section === tab.id ? styles.activeTab : ""}`}
            onClick={() => setSection(tab.id)}
          >
            {tab.icon}
            {t(`${NS}.${tab.key}`, tab.fallback)}
          </button>
        ))}
      </div>

      {section === "okrs" && <OkrSection />}
      {section === "ninebox" && <NineBoxSection />}
      {section === "coach" && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>{t(`${NS}.coach_title`, "AI manager coach")}</h3>
          </div>
          <div className={styles.notice}>
            <p>{t(`${NS}.coach_body`, "Draft a growth action for a team member from their objectives and feedback.")}</p>
            <button type="button" className={styles.btnPrimary} onClick={() => launchAction("growthAction")}>
              {t(`${NS}.coach_action`, "Create growth action")}
            </button>
          </div>
        </section>
      )}
      {section === "succession" && (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3>{t(`${NS}.succession_title`, "Succession risk")}</h3>
          </div>
          <p className={styles.flagNotice}>
            {t(`${NS}.succession_unavailable`, "Succession risk is not available: succession plans can be recorded, but no endpoint reads them back yet.")}
          </p>
        </section>
      )}
    </div>
  );
}
