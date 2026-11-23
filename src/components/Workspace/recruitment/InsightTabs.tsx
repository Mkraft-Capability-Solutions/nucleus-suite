"use client";

import { FileCheck, Shield } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import type { Translate } from "../workspaceHttp";
import type { FairnessView, InterviewOverview, Loadable } from "./types";
import { NS } from "./useRecruitmentData";
import { SourceState, formatDate } from "./parts";

/** Tab four: interview plans (rounds, competencies) and sessions from GET /api/v1/talent-pipeline?view=interviews. */
export function InterviewsTab({ t, locale, source, onRetry }: { t: Translate; locale: string | undefined; source: Loadable<InterviewOverview>; onRetry: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3><FileCheck size={20} aria-hidden="true" />{t(`${NS}.text_interview_title`, "Role-based structured question banks and rubrics")}</h3>
          <p>{t(`${NS}.text_interview_body`, "Interview plans set the rounds and competencies for a requisition. Panel scorecards stay sealed until the debrief.")}</p>
        </div>
        <div className={styles.scaleRow} aria-label={t(`${NS}.text_rating_scale`, "Rating scale")}>
          <span className={`${styles.badge} ${styles.badgeMuted}`}>{t(`${NS}.text_scale_basic`, "1 - Basic")}</span>
          <span className={`${styles.badge} ${styles.badgeInfo}`}>{t(`${NS}.text_scale_competent`, "3 - Competent")}</span>
          <span className={`${styles.badge} ${styles.badgeSuccess}`}>{t(`${NS}.text_scale_expert`, "5 - Expert mastery")}</span>
        </div>
      </div>
      <SourceState t={t} source={source} onRetry={onRetry}>
        {(data) => (
          <div className={styles.stack}>
            {data.plans.length === 0 ? (
              <p className={styles.emptyNote}>{t(`${NS}.text_plans_empty`, "No interview plans have been set up yet.")}</p>
            ) : (
              <div className={styles.planGrid}>
                {data.plans.map((plan) => (
                  <div key={plan.planId} className={styles.deptCapacityCard}>
                    <div className={styles.cardTop}>
                      <strong>{plan.title ?? t(`${NS}.text_untitled_plan`, "Untitled plan")}</strong>
                      <span className={`${styles.badge} ${styles.badgeInfo}`}>{plan.status}</span>
                    </div>
                    <span className={styles.sub}>{plan.requisitionTitle ?? t(`${NS}.text_role_unrecorded`, "Role not recorded")} · {t(`${NS}.text_session_count`, "{count} session(s)", { count: plan.sessionCount })}</span>
                    <div className={styles.skillTags}>{plan.rounds.map((round) => <span key={round} className={styles.skillTag}>{round}</span>)}</div>
                    {plan.competencies.length > 0
                      ? <ul className={styles.list}>{plan.competencies.map((competency) => <li key={competency}>{competency}</li>)}</ul>
                      : <span className={styles.hint}>{t(`${NS}.text_no_competencies`, "No competencies on the scorecard yet.")}</span>}
                  </div>
                ))}
              </div>
            )}
            {data.sessions.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{t(`${NS}.text_col_candidate`, "Candidate")}</th>
                      <th scope="col">{t(`${NS}.text_col_plan`, "Plan / round")}</th>
                      <th scope="col">{t(`${NS}.text_col_scheduled`, "Scheduled")}</th>
                      <th scope="col">{t(`${NS}.text_col_panel`, "Scorecards filed")}</th>
                      <th scope="col">{t(`${NS}.text_col_status`, "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map((session) => (
                      <tr key={session.sessionId}>
                        <td>{session.candidateName ?? "—"}</td>
                        <td>{session.planTitle ?? "—"}<span className={styles.sub}>{session.round ?? ""}</span></td>
                        <td>{formatDate(session.scheduledAt, locale)}</td>
                        <td className={styles.mono}>{session.cardsSubmitted} / {session.panel.length}</td>
                        <td><span className={`${styles.badge} ${session.debriefed ? styles.badgeSuccess : styles.badgeWarning}`}>{session.debriefed ? t(`${NS}.text_debriefed`, "Debriefed") : session.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SourceState>
    </div>
  );
}

/** Tab five: adverse-impact readiness from GET /api/v1/talent-pipeline?view=fairness. No ratio is shown without its inputs. */
export function FairnessTab({ t, source, onRetry }: { t: Translate; source: Loadable<FairnessView>; onRetry: () => void }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h3><Shield size={20} aria-hidden="true" />{t(`${NS}.text_bias_title`, "Hiring bias detection and fairness")}</h3>
          <p>{t(`${NS}.text_bias_body`, "An adverse impact ratio compares selection rates across groups. It is reported only when every input it needs is captured lawfully.")}</p>
        </div>
      </div>
      <SourceState t={t} source={source} onRetry={onRetry}>
        {(data) => (
          <div className={styles.stack}>
            <div className={data.readiness.computable ? styles.previewOk : styles.previewInfo}>
              <span>
                <strong>{t(`${NS}.text_air`, "Adverse impact ratio (AIR)")}: </strong>
                {data.readiness.computable ? t(`${NS}.text_air_ready`, "Ready to compute") : t(`${NS}.text_air_unavailable`, "Not available")}
                <span className={styles.sub}>{data.readiness.statement}</span>
              </span>
            </div>
            {data.readiness.missing.length > 0 && (
              <ul className={styles.list}>
                {data.readiness.missing.map((item) => <li key={item.key}><strong>{item.label}.</strong> {item.requirement}</li>)}
              </ul>
            )}
          </div>
        )}
      </SourceState>
    </div>
  );
}
