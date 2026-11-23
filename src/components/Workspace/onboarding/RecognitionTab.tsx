"use client";

import { Award, Calendar, Gift, UserCheck } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import styles from "../OnboardingView.module.css";
import type { Translate } from "./api";
import StateNote from "./StateNote";
import { useResource, type ResourceState } from "./useResource";

/**
 * Recognition: upcoming birthdays, work anniversaries and new joiners from
 * GET /api/v1/onboarding/celebrations, and the awards wall from GET /api/v1/recognition-register.
 */

const NS = "components.Workspace.OnboardingView";

export type Programme = { id: string; name: string; currency: string; awardCeilingMinor: number | null; defaultAwardMinor: number | null };
export type AwardRow = {
  id: string; state: string; nomineeName: string | null; nomineeDepartment: string | null; nominatorName: string | null;
  programmeName: string; citation: string; awardMinor: number | null; currency: string; periodStart: string | null; periodEnd: string | null; createdAt: string;
};
export type RecognitionRegister = { items: AwardRow[]; programmes: Programme[]; count: number; canWrite: boolean; citationMinimum: number };

type Person = { employeeId: string; employeeCode: string; name: string; department: string | null; occursOn: string; years: number | null };
type Section = { available: boolean; reason?: string; items: Person[] };
type Celebrations = { windowDays: number; birthdays: Section; anniversaries: Section; newJoiners: Section };

const STATE_TONE: Record<string, string> = {
  nominated: styles.badgeWarning, approved: styles.badgeInfo, published: styles.badgePurple, paid: styles.badgeSuccess, rejected: styles.badgeDanger,
};

export default function RecognitionTab({ register, onReload, onGrant, formatDate, formatMoney }: {
  register: ResourceState<RecognitionRegister>;
  onReload: () => void;
  onGrant: () => void;
  formatDate: (iso: string | null) => string;
  formatMoney: (minor: number, currency: string) => string;
}) {
  const { t: rawT } = useTranslation();
  const t = rawT as Translate;
  const celebrations = useResource<Celebrations>("/api/v1/onboarding/celebrations?days=30", t(`${NS}.celebrations_failed`, "Upcoming celebrations could not be loaded."));

  const section = (key: "birthdays" | "anniversaries" | "newJoiners", Icon: typeof Gift, title: string, empty: string) => {
    const state = celebrations.state;
    return (
      <div className={styles.celebCard}>
        <div className={styles.celebHead}><Icon size={18} aria-hidden="true" />{title}</div>
        {state.status === "loading" && <span className={styles.muted}>{t(`${NS}.loading`, "Loading…")}</span>}
        {state.status === "error" && <span className={styles.fieldError} role="alert">{state.message}</span>}
        {state.status === "ready" && !state.data[key].available && <span className={styles.muted}>{t(`${NS}.celebrations_no_permission`, "Your role cannot see birth dates.")}</span>}
        {state.status === "ready" && state.data[key].available && state.data[key].items.length === 0 && <span className={styles.muted}>{empty}</span>}
        {state.status === "ready" && state.data[key].items.map((person) => (
          <div key={`${key}-${person.employeeId}`} className={styles.celebRow}>
            <span><strong>{person.name}</strong>{person.department ? <span className={styles.muted}> · {person.department}</span> : null}</span>
            <span className={styles.celebWhen}>
              {key === "anniversaries" && person.years !== null
                ? t(`${NS}.anniversary_on`, "{years} yr · {date}", { years: person.years, date: formatDate(person.occursOn) })
                : formatDate(person.occursOn)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.stack}>
      <section className={`${styles.card} ${styles.cardAccent}`}>
        <div className={styles.cardHead}>
          <div>
            <h3 className={styles.cardTitle}><Award size={20} aria-hidden="true" />{t(`${NS}.recognition_title`, "Recognition and milestones")}</h3>
            <p className={styles.cardSub}>{t(`${NS}.recognition_subtitle`, "Nominate people for awards and see who is celebrating in the next 30 days.")}</p>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={onGrant} disabled={register.status === "ready" && !register.data.canWrite} title={register.status === "ready" && !register.data.canWrite ? t(`${NS}.recognition_no_write`, "Your role cannot nominate awards.") : undefined}>
            <Award size={15} aria-hidden="true" />{t(`${NS}.recognition_nominate`, "Nominate for an award")}
          </button>
        </div>
      </section>

      <div className={styles.grid3}>
        {section("birthdays", Gift, t(`${NS}.birthdays`, "Upcoming birthdays"), t(`${NS}.birthdays_none`, "No birthdays in the next 30 days."))}
        {section("anniversaries", Calendar, t(`${NS}.anniversaries`, "Work anniversaries"), t(`${NS}.anniversaries_none`, "No work anniversaries in the next 30 days."))}
        {section("newJoiners", UserCheck, t(`${NS}.new_joiners`, "New joiners"), t(`${NS}.new_joiners_none`, "No one joined recently or is due to join."))}
      </div>

      <section className={styles.card} aria-labelledby="recognition-wall-title">
        <div className={styles.cardHead}>
          <h3 id="recognition-wall-title" className={styles.cardTitleSm}>{t(`${NS}.wall_title`, "Recognition wall")}</h3>
          {register.status === "ready" && <span className={styles.muted}>{t(`${NS}.wall_count`, "{count} awards", { count: register.data.count })}</span>}
        </div>
        {register.status === "loading" && <StateNote tone="loading">{t(`${NS}.loading`, "Loading…")}</StateNote>}
        {register.status === "error" && <StateNote tone="error" onRetry={onReload} retryLabel={t(`${NS}.retry`, "Try again")}>{register.message}</StateNote>}
        {register.status === "ready" && register.data.items.length === 0 && <StateNote tone="empty">{t(`${NS}.wall_empty`, "No awards yet. Nominate someone to start the wall.")}</StateNote>}
        {register.status === "ready" && register.data.items.length > 0 && (
          <div className={styles.wall}>
            {register.data.items.map((award) => (
              <article key={award.id} className={styles.awardCard}>
                <div className={styles.cardHead}>
                  <div>
                    <strong>{award.nomineeName ?? t(`${NS}.unknown_employee`, "Employee not found")}</strong>
                    {award.nomineeDepartment && <div className={styles.muted}>{award.nomineeDepartment}</div>}
                  </div>
                  <span className={`${styles.badge} ${STATE_TONE[award.state] ?? ""}`}>{t(`${NS}.award_state_${award.state}`, award.state)}</span>
                </div>
                <div className={styles.muted}>{award.programmeName}{award.periodStart && award.periodEnd ? ` · ${formatDate(award.periodStart)} – ${formatDate(award.periodEnd)}` : ""}</div>
                <p className={styles.citation}>{award.citation}</p>
                <div className={styles.awardFoot}>
                  <span>{award.nominatorName ? t(`${NS}.nominated_by`, "Nominated by {name}", { name: award.nominatorName }) : formatDate(award.createdAt)}</span>
                  {award.awardMinor !== null && <strong className={styles.mono}>{formatMoney(award.awardMinor, award.currency)}</strong>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
