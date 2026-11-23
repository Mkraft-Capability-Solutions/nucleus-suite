"use client";

import HowToRegOutlined from "@mui/icons-material/HowToRegOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import AssessmentOutlined from "@mui/icons-material/AssessmentOutlined";
import { useTranslation } from "@/context/I18nContext";
import type { TalentInsights, WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { Bar, CardHeader, NS, Notice, StatCard, sectionReason, useFormat } from "./AnalyticsParts";
import styles from "../AnalyticsView.module.css";

const STAGES: Record<TalentInsights["funnel"][number]["key"], { key: string; fallback: string; fill: "signal" | "info" | "ok" | "pending" }> = {
  applied: { key: "text_funnel_applied", fallback: "1. Applications Received", fill: "signal" },
  screened: { key: "text_funnel_screened", fallback: "2. Resume Screening Passed", fill: "info" },
  interviewed: { key: "text_funnel_interviewed", fallback: "3. Technical & Culture Rounds", fill: "info" },
  offered: { key: "text_funnel_offered", fallback: "4. Offer Extended", fill: "pending" },
  joined: { key: "text_funnel_joined", fallback: "5. Joined & Onboarded", fill: "ok" },
};

export default function TalentTab({ data }: { data: WorkforceInsightsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { talent } = data;
  const reason = sectionReason(t, talent);
  const v = talent.available ? talent.value : null;
  const noApps = t(`${NS}.text_no_applications_in_period`, "No applications in this period.");

  return (
    <div className={styles.panel}>
      <div className={styles.statsGrid}>
        <StatCard icon={<HowToRegOutlined />} tone="signal" label={t(`${NS}.text_average_time-to-hire`, "Average Time-to-Hire")}
          value={v && v.avgTimeToHireDays !== null ? t(`${NS}.value_days`, "{value} days", { value: f.number(v.avgTimeToHireDays) }) : null}
          reason={reason ?? t(`${NS}.text_no_joiners_in_period`, "No application reached Joined in this period.")} />
        <StatCard icon={<TrendingUpOutlined />} tone="ok" label={t(`${NS}.text_offer_acceptance_rate`, "Offer Acceptance Rate")}
          value={v && v.offerAcceptance !== null ? f.pct(v.offerAcceptance) : null}
          reason={reason ?? t(`${NS}.text_no_offers_in_period`, "No offer was extended in this period.")} />
        <StatCard icon={<PeopleAltOutlined />} tone="info" label={t(`${NS}.text_referral_hire_sourcing_share`, "Referral Hire Sourcing Share")}
          value={v && v.referralShare !== null ? f.pct(v.referralShare) : null} reason={reason ?? noApps} />
        <StatCard icon={<SpeedOutlined />} tone="pending" label={t(`${NS}.text_open_approved_positions`, "Open Approved Positions")}
          value={v ? t(`${NS}.value_requisitions`, "{value} Req", { value: f.number(v.openPositions) }) : null} reason={reason} />
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <CardHeader icon={<HowToRegOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_candidate_conversion_funnel`, "Candidate Conversion Funnel")} />
          {!v || v.applications === 0 ? (
            <Notice>{reason ?? noApps}</Notice>
          ) : (
            <div className={styles.list}>
              {v.funnel.map((step) => {
                const share = (step.value / v.applications) * 100;
                const meta = STAGES[step.key];
                return (
                  <Bar key={step.key} label={t(`${NS}.${meta.key}`, meta.fallback)} percent={share} fill={meta.fill}
                    valueText={t(`${NS}.value_count_share`, "{count} ({share})", { count: f.number(step.value), share: f.pct(share) })} />
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <CardHeader icon={<AssessmentOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_sourcing_channel_effectiveness`, "Sourcing Channel Effectiveness")} />
          {!v || v.channels.length === 0 ? (
            <Notice>{reason ?? noApps}</Notice>
          ) : (
            <div className={styles.list}>
              {v.channels.map((row) => (
                <div key={row.channel || "unrecorded"} className={styles.rowTile}>
                  <div>
                    <div className={styles.rowTitle}>{row.channel || t(`${NS}.text_source_unrecorded`, "Source not recorded")}</div>
                    <div className={styles.rowSub}>
                      {t(`${NS}.text_channel_quality`, "Quality: {joined} joined of {applications} ({conversion})", {
                        joined: f.number(row.joined),
                        applications: f.number(row.applications),
                        conversion: row.conversion === null ? "—" : f.pct(row.conversion),
                      })}
                    </div>
                  </div>
                  <div className={styles.rowValue} style={{ color: "var(--signal)" }}>{f.pct(row.share)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
