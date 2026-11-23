"use client";

import PeopleAltOutlined from "@mui/icons-material/PeopleAltOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import SecurityOutlined from "@mui/icons-material/SecurityOutlined";
import { useTranslation } from "@/context/I18nContext";
import type { WorkforceInsightsPayload } from "@/lib/analytics/workforce-insights-types";
import { Badge, Bar, CardHeader, NS, Notice, StatCard, reasonText, sectionReason, useFormat } from "./AnalyticsParts";
import styles from "../AnalyticsView.module.css";

export default function PeopleTab({ data }: { data: WorkforceInsightsPayload }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { people, attrition, risk } = data;
  const peopleReason = sectionReason(t, people);
  const attritionReason = sectionReason(t, attrition);

  const gender = people.available ? people.value.gender : null;
  const recorded = gender ? gender.female + gender.male + gender.other : 0;
  const genderRows = gender
    ? ([
        ["female", t(`${NS}.text_female_representation`, "Female Representation"), gender.female, "signal"],
        ["male", t(`${NS}.text_male_representation`, "Male Representation"), gender.male, "info"],
        ["other", t(`${NS}.text_non-binary_self-identified`, "Non-Binary / Self-Identified"), gender.other, "ok"],
      ] as const)
    : [];

  return (
    <div className={styles.panel}>
      <div className={styles.statsGrid}>
        <StatCard icon={<PeopleAltOutlined />} tone="signal" label={t(`${NS}.text_active_global_headcount`, "Active Global Headcount")}
          value={people.available ? f.number(people.value.activeHeadcount) : null} reason={peopleReason} />
        <StatCard icon={<TrendingUpOutlined />} tone="ok" label={t(`${NS}.text_diversity_inclusion_index`, "Diversity & Inclusion Index")}
          value={people.available && people.value.diversityIndex !== null ? t(`${NS}.value_out_of_100`, "{value} / 100", { value: f.number(people.value.diversityIndex, 1) }) : null}
          reason={peopleReason ?? reasonText(t, "no_gender_recorded")} />
        <StatCard icon={<SpeedOutlined />} tone="pending" label={t(`${NS}.text_annualized_attrition`, "Annualized Attrition")}
          value={attrition.available ? f.pct(attrition.value.annualizedAttrition) : null} reason={attritionReason} />
        <StatCard icon={<SecurityOutlined />} tone="info" label={t(`${NS}.text_retention_rate`, "Retention Rate")}
          value={attrition.available ? f.pct(attrition.value.retentionRate) : null} reason={attritionReason} />
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <CardHeader icon={<PeopleAltOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_gender_demographic_diversity`, "Gender & Demographic Diversity")}
            badge={gender ? <Badge tone="info">{t(`${NS}.text_gender_coverage`, "Recorded for {recorded} of {total}", { recorded: f.number(recorded), total: f.number(recorded + gender.unrecorded) })}</Badge> : null} />
          {!gender || recorded === 0 ? (
            <Notice>{peopleReason ?? reasonText(t, "no_gender_recorded")}</Notice>
          ) : (
            <div className={styles.list}>
              {genderRows.map(([key, label, count, fill]) => {
                const share = (count / recorded) * 100;
                return (
                  <Bar key={key} label={label} percent={share} fill={fill}
                    valueText={t(`${NS}.value_share_of_employees`, "{share} ({count} employees)", { share: f.pct(share), count: f.number(count) })} />
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <CardHeader icon={<SpeedOutlined sx={{ fontSize: 18 }} />} title={t(`${NS}.text_flight_risk_attrition_breakdown`, "Flight Risk & Attrition Breakdown")}
            badge={risk.available ? <Badge tone="signal">{t(`${NS}.text_scored_employees`, "{count} employees scored", { count: f.number(risk.value.scored) })}</Badge> : null} />
          {!risk.available ? (
            <Notice>{reasonText(t, risk.reason)}</Notice>
          ) : (
            <div className={styles.list}>
              {([
                ["low", t(`${NS}.text_low_risk_stable`, "Low Risk (Stable)"), t(`${NS}.text_high_engagement_market_parity`, "High engagement & market parity"), risk.value.low, "var(--status-ok)"],
                ["medium", t(`${NS}.text_medium_risk_watchlist`, "Medium Risk (Watchlist)"), t(`${NS}.text_overtime_spikes_or_stagnant_band`, "Overtime spikes or stagnant band"), risk.value.medium, "var(--pending)"],
                ["high", t(`${NS}.text_high_flight_risk_urgent`, "High Flight Risk (Urgent)"), t(`${NS}.text_under-compensated_vs_peer_quartile`, "Under-compensated vs peer quartile"), risk.value.high, "var(--flag)"],
              ] as const).map(([key, title, sub, count, color]) => (
                <div key={key} className={styles.rowTile}>
                  <div>
                    <div className={styles.rowTitle}>{title}</div>
                    <div className={styles.rowSub}>{sub}</div>
                  </div>
                  <div className={styles.rowValue} style={{ color }}>{f.pct((count / risk.value.scored) * 100)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
