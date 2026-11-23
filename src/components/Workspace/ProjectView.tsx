"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, Filter, Plus, RefreshCw } from "lucide-react";
import { useTranslation } from "@/context/I18nContext";
import { useHRMS } from "@/context/HRMSContext";
import styles from "./ProjectView.module.css";
import { errorMessage, getData, sendJson, type Employee, type Translate } from "./workspaceHttp";
import { NS, ProjectModal, TaskModal } from "./project/ProjectForms";
import { ProjectCards, TaskBoard } from "./project/ProjectBoardParts";
import type { BoardTask, ProjectBoard, TaskColumn } from "./project/types";

type Toast = (title: string, message: string, type?: "success" | "error" | "info" | "warning") => void;
type Load = { status: "loading" } | { status: "ready"; board: ProjectBoard } | { status: "error"; message: string };
type Props = { onNavigate?: unknown; onSelectConsole?: unknown; activeSubFeature?: unknown };

/**
 * Project workspace. Projects, tasks, members, progress and the viewer's own tasks come from
 * GET /api/v1/projects/board (visibility decided on the server); writes go to POST /api/v1/projects,
 * POST /api/v1/projects/tasks and PATCH /api/v1/projects/tasks/:id/status, and the board refreshes only after the server accepts.
 */
export default function ProjectView(_props: Props) {
  const { t: rawT, locale } = useTranslation();
  const t = rawT as Translate;
  const { showToast } = (useHRMS() ?? {}) as { showToast?: Toast };
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [people, setPeople] = useState<Employee[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [modal, setModal] = useState<"task" | "project" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const failed = t(`${NS}.text_load_failed`, "The project board could not be loaded.");
    getData<ProjectBoard>("/api/v1/projects/board", failed, controller.signal)
      .then((board) => setLoad({ status: "ready", board }))
      .catch((error: unknown) => { if (!controller.signal.aborted) setLoad({ status: "error", message: errorMessage(error, failed) }); });
    getData<Employee[]>("/api/v1/people?pageSize=100", failed, controller.signal).then(setPeople).catch(() => undefined);
    return () => controller.abort();
  }, [t, attempt]);

  const board = load.status === "ready" ? load.board : null;
  const active = board?.projects.find((p) => p.id === selectedId) ?? board?.projects[0] ?? null;
  const tasks = (board?.tasks ?? []).filter((task) => task.projectId === active?.id && (!mineOnly || task.assignedToViewer));
  const canWrite = board?.viewer.canWrite ?? false;

  const move = async (task: BoardTask, to: TaskColumn) => {
    if (busyId) return;
    setBusyId(task.id);
    try {
      await sendJson(`/api/v1/projects/tasks/${encodeURIComponent(task.id)}/status`, { method: "PATCH", body: { from: task.column, to }, idempotencyKey: crypto.randomUUID() }, t(`${NS}.text_move_failed`, "The task could not be moved."));
      reload();
    } catch (error) {
      showToast?.(t(`${NS}.text_move_failed`, "The task could not be moved."), errorMessage(error, ""), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={styles.projectContainer}>
      <div className={styles.headerRow}>
        <div className={styles.titleBlock}>
          <h2>{t(`${NS}.text_title`, "Project workspace and task orchestration")}</h2>
          <p>{t(`${NS}.text_subtitle`, "Track sprint deliverables, assign cross-functional tasks, and monitor pod completion.")}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={`${styles.btnSecondary} ${mineOnly ? styles.btnToggleOn : ""}`} aria-pressed={mineOnly} onClick={() => setMineOnly((v) => !v)} disabled={!board?.viewer.employeeId}
            title={board && !board.viewer.employeeId ? t(`${NS}.text_no_employee_link`, "Your account is not linked to an employee record.") : undefined}>
            <Filter size={15} aria-hidden="true" />{mineOnly ? t(`${NS}.text_showing_mine`, "Showing: my tasks") : t(`${NS}.text_filter_mine`, "Filter: my tasks")}
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setModal("task")} disabled={!canWrite || !board?.projects.length}><Plus size={18} aria-hidden="true" />{t(`${NS}.text_assign_task`, "Assign new task")}</button>
          <button type="button" className={styles.btnInfo} onClick={() => setModal("project")} disabled={!canWrite}><Plus size={18} aria-hidden="true" />{t(`${NS}.text_new_project`, "New project")}</button>
        </div>
      </div>

      {load.status === "loading" && <p className={styles.hint} role="status">{t(`${NS}.text_loading`, "Loading…")}</p>}
      {load.status === "error" && (
        <div className={styles.errorNote} role="alert"><span>{load.message}</span><button type="button" className={styles.btnSecondary} onClick={reload}><RefreshCw size={14} aria-hidden="true" />{t(`${NS}.text_retry`, "Retry")}</button></div>
      )}
      {board && !canWrite && <p className={styles.infoNote}>{t(`${NS}.text_read_only`, "You can view projects but your role cannot create or move tasks.")}</p>}
      {board && (
        <div className={styles.mainLayout}>
          <ProjectCards t={t} locale={locale} projects={board.projects} activeId={active?.id ?? null} canWrite={canWrite} onSelect={setSelectedId} onCreate={() => setModal("project")} />
          {active ? (
            <div className={styles.kanbanSection}>
              <div className={styles.sectionTitle}>
                <span className={styles.sectionName}><Briefcase size={20} aria-hidden="true" />{t(`${NS}.text_active_tasks`, "Active tasks ({project})", { project: active.title })}</span>
                {canWrite && <button type="button" className={styles.btnSecondary} onClick={() => setModal("task")}><Plus size={14} aria-hidden="true" />{t(`${NS}.text_add_task_to`, "Add task to {project}", { project: active.title })}</button>}
              </div>
              <TaskBoard t={t} locale={locale} tasks={tasks} busyId={busyId} canWrite={canWrite} onMove={move} />
            </div>
          ) : (
            <p className={styles.emptyCol}>{t(`${NS}.text_no_projects`, "No projects are visible to you yet.")}</p>
          )}
        </div>
      )}

      {modal === "task" && board && (
        <TaskModal t={t} projects={board.projects} people={people} initialProjectId={active?.id ?? null} viewerEmployeeId={board.viewer.employeeId} onClose={() => setModal(null)}
          onCreated={(title) => { setModal(null); showToast?.(t(`${NS}.text_task_created`, "Task created"), title, "success"); reload(); }} />
      )}
      {modal === "project" && (
        <ProjectModal t={t} people={people} onClose={() => setModal(null)}
          onCreated={(title) => { setModal(null); showToast?.(t(`${NS}.text_project_created`, "Project created"), title, "success"); reload(); }} />
      )}
    </div>
  );
}
