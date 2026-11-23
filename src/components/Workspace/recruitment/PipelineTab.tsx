"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, GripVertical, Sparkles } from "lucide-react";
import styles from "../RecruitmentView.module.css";
import type { Translate } from "../workspaceHttp";
import type { PipelineBoard, PipelineCard } from "./types";
import { NS } from "./useRecruitmentData";

type Props = {
  t: Translate;
  board: PipelineBoard;
  busyId: string | null;
  onAdvance: (card: PipelineCard) => void;
  onRefuse: (message: string) => void;
};

/**
 * Tab one: the application board from GET /api/v1/talent-pipeline?view=board. A card moves only to its one
 * legal next stage (POST /api/v1/applications/:id/advance), by button, stage picker or drag; moving back is
 * shown but disabled because the stage contract allows no backward move.
 */
export default function PipelineTab({ t, board, busyId, onAdvance, onRefuse }: Props) {
  const [dragging, setDragging] = useState<PipelineCard | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const drop = (columnStages: string[]) => {
    const card = dragging;
    setDragging(null);
    setDragOver(null);
    if (!card) return;
    if (card.nextStage && columnStages.includes(card.nextStage)) {
      onAdvance(card);
    } else if (!columnStages.includes(card.stage)) {
      onRefuse(card.nextStageLabel
        ? t(`${NS}.text_drop_refused`, "Stages advance one step at a time. {name} can only move to {stage}.", { name: card.candidateName, stage: card.nextStageLabel })
        : t(`${NS}.text_drop_final`, "{name} is at the last stage and cannot move further.", { name: card.candidateName }));
    }
  };

  return (
    <div className={styles.stack}>
      <p className={styles.note}>{t(`${NS}.text_score_advisory`, "The match score is assistive. It rejects nobody and is never used to rank candidates against one another.")}</p>
      {board.unmapped.length > 0 && (
        <p className={styles.errorNote} role="status">{t(`${NS}.text_unmapped`, "{count} application(s) have a stage outside the hiring flow and are not shown on the board.", { count: board.unmapped.length })}</p>
      )}
      <div className={styles.pipelineGrid}>
        {board.columns.map((column) => (
          <section
            key={column.id}
            aria-label={column.label}
            className={`${styles.column} ${dragOver === column.id ? styles.columnDragOver : ""}`}
            onDragOver={(event) => { event.preventDefault(); if (dragOver !== column.id) setDragOver(column.id); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(null); }}
            onDrop={(event) => { event.preventDefault(); drop(column.stages); }}
          >
            <div className={styles.colHeader}>
              <span className={styles.colTitle}>{column.label}</span>
              <span className={styles.countBadge}>{column.cards.length}</span>
            </div>
            <p className={styles.colCaption}>{column.caption}</p>
            {column.cards.length === 0 && <p className={styles.emptyNote}>{t(`${NS}.text_column_empty`, "No applications at this stage.")}</p>}
            {column.cards.map((card) => (
              <CandidateCard key={card.applicationId} t={t} card={card} busy={busyId === card.applicationId} dragging={dragging?.applicationId === card.applicationId}
                onDragStart={() => setDragging(card)} onDragEnd={() => { setDragging(null); setDragOver(null); }} onAdvance={() => onAdvance(card)} />
            ))}
            {dragOver === column.id && dragging && (
              <div className={styles.dropPlaceholder}>{t(`${NS}.text_drop_candidate_to_move_to`, "Drop candidate to move to {stage}", { stage: column.label })}</div>
            )}
          </section>
        ))}
      </div>
      {board.closed.length > 0 && (
        <p className={styles.muted}>{t(`${NS}.text_closed_count`, "{count} application(s) have ended (withdrawn, rejected, declined or closed).", { count: board.closed.length })}</p>
      )}
    </div>
  );
}

function CandidateCard({ t, card, busy, dragging, onDragStart, onDragEnd, onAdvance }: {
  t: Translate; card: PipelineCard; busy: boolean; dragging: boolean; onDragStart: () => void; onDragEnd: () => void; onAdvance: () => void;
}) {
  const backReason = t(`${NS}.text_back_disabled`, "Stages only move forward, one step at a time, by human decision.");
  return (
    <article
      className={`${styles.candidateCard} ${dragging ? styles.candidateCardDragging : ""}`}
      draggable={Boolean(card.nextStage) && !busy}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.applicationId); onDragStart(); }}
      onDragEnd={onDragEnd}
      aria-busy={busy}
    >
      <div className={styles.cardTop}>
        <span className={styles.cardName}>
          <span className={styles.dragGrip} aria-hidden="true"><GripVertical size={14} /></span>
          {card.candidateName}
        </span>
        <span className={`${styles.scoreBadge} ${card.matchScore === null ? styles.scoreBadgeMuted : ""}`}>
          <Sparkles size={12} aria-hidden="true" />
          {card.matchScore === null ? t(`${NS}.text_not_scored`, "Not scored") : t(`${NS}.text_match`, "{score}% match", { score: card.matchScore })}
        </span>
      </div>
      <div className={styles.cardRole}>{card.roleTitle ?? t(`${NS}.text_role_unrecorded`, "Role not recorded")}{card.department ? ` · ${card.department}` : ""}</div>
      <div className={styles.cardMeta}>
        {card.experienceYears === null
          ? t(`${NS}.text_exp_not_captured`, "Experience not captured")
          : t(`${NS}.text_exp_years`, "Experience: {years} yrs", { years: card.experienceYears })}
        {card.requisitionCode ? ` · ${card.requisitionCode}` : ""}
      </div>
      <div className={styles.skillTags}>
        {card.skills.length === 0
          ? <span className={styles.hint}>{t(`${NS}.text_no_skills`, "No skills recorded")}</span>
          : card.skills.map((skill) => <span key={skill} className={styles.skillTag}>{skill}</span>)}
      </div>
      <div className={styles.cardFooter}>
        <label className={styles.stageRow}>
          {t(`${NS}.text_stage`, "Stage")}
          <select
            className={styles.stageSelect}
            value={card.stage}
            disabled={busy || !card.nextStage}
            onChange={(event) => { if (event.target.value === card.nextStage) onAdvance(); }}
            title={t(`${NS}.title_jump_directly_to_any_stage`, "Move to the next stage")}
          >
            <option value={card.stage}>{card.stageLabel}</option>
            {card.nextStage && <option value={card.nextStage}>{card.nextStageLabel ?? card.nextStage}</option>}
          </select>
        </label>
        <div className={styles.cardNavRow}>
          <button type="button" className={styles.stepBtn} disabled title={backReason} aria-label={backReason}>
            <ChevronLeft size={14} aria-hidden="true" />{t(`${NS}.text_prev`, "Prev")}
          </button>
          <button type="button" className={`${styles.stepBtn} ${styles.stepBtnNext}`} disabled={busy || !card.nextStage} onClick={onAdvance}
            title={card.nextStageLabel ? t(`${NS}.title_advance_to`, "Advance to {stage}", { stage: card.nextStageLabel }) : t(`${NS}.text_drop_final_short`, "Last stage reached")}>
            {busy ? t(`${NS}.text_moving`, "Moving…") : t(`${NS}.text_next`, "Next")}<ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
