"use client";

import NextImage from "next/image";
import { CheckCircle, Clock, Plus } from "lucide-react";
import { avatarDataUri } from "@/lib/avatar";
import styles from "../ProjectView.module.css";
import type { Translate } from "../workspaceHttp";
import { TASK_COLUMNS, type BoardProject, type BoardTask, type TaskColumn } from "./types";
import { NS } from "./ProjectForms";

const accentClass = (accent: string) => styles[`accent_${accent.replace("-", "_")}`] ?? "";

const formatDate = (iso: string | null, locale: string | undefined) =>
  iso ? new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(new Date(`${iso}T00:00:00`)) : null;

/** Project overview cards; progress is the server's share of tasks in Done, or "no tasks yet". */
export function ProjectCards({ t, locale, projects, activeId, canWrite, onSelect, onCreate }: {
  t: Translate; locale: string | undefined; projects: BoardProject[]; activeId: string | null; canWrite: boolean; onSelect: (id: string) => void; onCreate: () => void;
}) {
  return (
    <div className={styles.projectGrid}>
      {projects.map((project) => {
        const active = project.id === activeId;
        const due = formatDate(project.dueDate, locale);
        return (
          <button key={project.id} type="button" className={`${styles.projectCard} ${accentClass(project.accent)} ${active ? styles.projectCardActive : ""}`} onClick={() => onSelect(project.id)} aria-pressed={active}>
            <span className={styles.projHeader}>
              <span className={styles.projTitle}>{project.title}</span>
              {active && <span className={styles.activePill}>{t(`${NS}.text_active`, "Active")}</span>}
              <span className={styles.visPill}>{t(`${NS}.visibility_short_${project.visibility}`, project.visibility === "all" ? "Public" : project.visibility === "team" ? "Team" : "Confidential")}</span>
            </span>
            <span className={styles.projDesc}>{project.description ?? t(`${NS}.text_no_description`, "No description recorded.")}</span>
            <span className={styles.progressWrapper} role="img" aria-label={project.progressPercent === null ? t(`${NS}.text_no_tasks_yet`, "No tasks yet") : t(`${NS}.text_progress`, "{percent}% done", { percent: project.progressPercent })}>
              <span className={styles.progressBar} style={{ inlineSize: `${project.progressPercent ?? 0}%` }} />
            </span>
            <span className={styles.projMeta}>
              <span className={styles.projMembers}>
                {project.members.slice(0, 3).map((member) => (
                  <NextImage key={member.employeeId} unoptimized width={48} height={48} alt={member.name} title={member.name} src={avatarDataUri(member.name)} className={styles.memberAvatar} />
                ))}
                {project.members.length > 3 && <span className={styles.hint}>+{project.members.length - 3}</span>}
                {project.members.length === 0 && <span className={styles.hint}>{t(`${NS}.text_no_members`, "No pod members")}</span>}
              </span>
              <span className={styles.metaRight}>
                {project.viewerTaskCount > 0 && <span className={styles.mineBadge}>{t(`${NS}.text_for_you`, "{count} for you", { count: project.viewerTaskCount })}</span>}
                <span>{project.progressPercent === null ? t(`${NS}.text_no_tasks_yet`, "No tasks yet") : t(`${NS}.text_progress`, "{percent}% done", { percent: project.progressPercent })}</span>
                <span>{due ? t(`${NS}.text_due`, "Due {date}", { date: due }) : t(`${NS}.text_no_due`, "No due date")}</span>
              </span>
            </span>
          </button>
        );
      })}
      <button type="button" className={`${styles.projectCard} ${styles.newCard}`} onClick={onCreate} disabled={!canWrite} title={canWrite ? undefined : t(`${NS}.text_no_write`, "Your role cannot create projects.")}>
        <Plus size={32} aria-hidden="true" />
        <span className={styles.projTitle}>{t(`${NS}.text_create_new_project`, "Create new project")}</span>
        <span className={styles.hint}>{t(`${NS}.text_create_new_project_hint`, "Configure pod, due date and access")}</span>
      </button>
    </div>
  );
}

const COLUMN_LABELS: Record<TaskColumn, [string, string, string]> = {
  todo: ["col_todo", "To do", "No tasks in To do."],
  inprogress: ["col_inprogress", "In progress", "No active in-progress tasks."],
  review: ["col_review", "Review", "No tasks awaiting review."],
  done: ["col_done", "Done", "No completed tasks yet."],
};
const BACK_LABEL: Record<TaskColumn, [string, string]> = { todo: ["", ""], inprogress: ["text_back_todo", "Back to To do"], review: ["text_revise", "Revise"], done: ["text_reopen", "Reopen"] };
const NEXT_LABEL: Record<TaskColumn, [string, string]> = { todo: ["text_start", "Start"], inprogress: ["text_to_review", "Submit for review"], review: ["text_approve", "Approve"], done: ["", ""] };

/** Four columns; a task moves one column at a time (PATCH /api/v1/projects/tasks/:id/status). */
export function TaskBoard({ t, locale, tasks, busyId, canWrite, onMove }: {
  t: Translate; locale: string | undefined; tasks: BoardTask[]; busyId: string | null; canWrite: boolean; onMove: (task: BoardTask, to: TaskColumn) => void;
}) {
  return (
    <div className={styles.kanbanBoard}>
      {TASK_COLUMNS.map((column, index) => {
        const list = tasks.filter((task) => task.column === column);
        const [key, label, empty] = COLUMN_LABELS[column];
        return (
          <section key={column} className={styles.kanbanColumn} aria-label={t(`${NS}.${key}`, label)}>
            <div className={styles.colHeader}><span className={styles.colTitle}>{t(`${NS}.${key}`, label)}</span><span className={styles.colCount}>{list.length}</span></div>
            {list.length === 0 && <p className={styles.emptyCol}>{t(`${NS}.${key}_empty`, empty)}</p>}
            {list.map((task) => {
              const busy = busyId === task.id;
              const due = formatDate(task.dueDate, locale);
              const prev = index > 0 ? TASK_COLUMNS[index - 1] : null;
              const next = index < TASK_COLUMNS.length - 1 ? TASK_COLUMNS[index + 1] : null;
              return (
                <article key={task.id} className={`${styles.taskCard} ${task.assignedToViewer ? styles.taskMine : ""} ${column === "done" ? styles.taskDone : ""}`} aria-busy={busy}>
                  <div className={styles.taskTags}>
                    {task.tag && <span className={styles.tag}>{t(`${NS}.tag_${task.tag}`, task.tag)}</span>}
                    {task.priority && <span className={`${styles.tag} ${task.priority === "urgent" || task.priority === "high" ? styles.tagHigh : ""}`}>{t(`${NS}.priority_${task.priority}`, task.priority)}</span>}
                    {task.assignedToViewer && <span className={styles.mineBadge}>{t(`${NS}.text_assigned_to_you`, "Assigned to you")}</span>}
                  </div>
                  <div className={styles.taskTitle}>{task.title}</div>
                  <div className={styles.taskFooter}>
                    <span className={styles.assignee}>
                      {task.assigneeName && <NextImage unoptimized width={48} height={48} alt="" src={avatarDataUri(task.assigneeName)} className={styles.taskAssignee} />}
                      {task.assigneeName ?? t(`${NS}.text_unassigned`, "Unassigned")}
                    </span>
                    <span className={styles.taskDue}>{column === "done" ? <><CheckCircle size={12} aria-hidden="true" />{t(`${NS}.text_done`, "Done")}</> : <><Clock size={12} aria-hidden="true" />{due ?? t(`${NS}.text_no_due`, "No due date")}</>}</span>
                  </div>
                  {canWrite && (
                    <div className={styles.taskActions}>
                      {prev && <button type="button" className={styles.stepBtn} disabled={busy} onClick={() => onMove(task, prev)}>{t(`${NS}.${BACK_LABEL[column][0]}`, BACK_LABEL[column][1])}</button>}
                      {next && <button type="button" className={`${styles.stepBtn} ${styles.stepBtnNext}`} disabled={busy} onClick={() => onMove(task, next)}>{busy ? t(`${NS}.text_moving`, "Moving…") : t(`${NS}.${NEXT_LABEL[column][0]}`, NEXT_LABEL[column][1])}</button>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
