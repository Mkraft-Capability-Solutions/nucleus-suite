"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Archive, ArchiveRestore, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Drawer, EmptyState, ErrorState, Field, IconButton, Input, Panel, Select, SkeletonRows } from "@/design/redesign/ui";
import { useNotify } from "@/modules/attendance/shared";
import { createTemplate, updateTemplate, useTemplates, type Template, type TemplateTask } from "./data";
import { OWNER_LABEL, taskKey } from "./format";
import styles from "./Lifecycle.module.css";

/** Onboarding checklists: the steps each new joiner goes through. */
export default function Templates({ canManage }: { canManage: boolean }) {
  const templates = useTemplates();
  const notify = useNotify();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = templates.data ?? [];

  async function toggle(template: Template) {
    const archived = template.attributes.status === "archived";
    setBusy(template.id);
    try {
      await updateTemplate(template.id, { status: archived ? "active" : "archived" });
      notify.success(archived ? "Checklist restored" : "Checklist archived", template.attributes.name ?? "");
      void templates.mutate();
    } catch (cause) {
      notify.error("Not saved", (cause as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.section}>
      {canManage && <div className={styles.toolbar}><span /><Button variant="primary" icon={Plus} onClick={() => setEditing("new")}>New checklist</Button></div>}
      {templates.error ? <ErrorState message={templates.error.message} onRetry={() => void templates.mutate()} />
        : !templates.data ? <Panel><SkeletonRows rows={4} columns={3} /></Panel>
          : rows.length === 0 ? <Panel><EmptyState icon={ListChecks} title="No onboarding checklists">A checklist lists the steps every joiner goes through and who owns each one.</EmptyState></Panel>
            : (
              <div className={styles.templateGrid}>
                {rows.map((template) => {
                  const tasks = template.attributes.tasks ?? [];
                  const archived = template.attributes.status === "archived";
                  return (
                    <Panel key={template.id} title={<span className={styles.inlineBadges}>{template.attributes.name ?? template.attributes.code}{archived && <Badge tone="neutral">Archived</Badge>}</span>}
                      subtitle={`${template.attributes.code ?? ""} · ${tasks.length} ${tasks.length === 1 ? "step" : "steps"}`}
                      actions={canManage ? (
                        <>
                          <IconButton label={`Edit ${template.attributes.name ?? "checklist"}`} icon={Pencil} variant="ghost" onClick={() => setEditing(template)} />
                          <IconButton label={archived ? "Restore" : "Archive"} icon={archived ? ArchiveRestore : Archive} variant="ghost" loading={busy === template.id} onClick={() => void toggle(template)} />
                        </>
                      ) : undefined}>
                      <ol className={styles.stepList}>
                        {tasks.map((task, index) => (
                          <li key={`${task.key ?? task.code ?? index}`}>
                            <span>{task.title}</span>
                            <span className={styles.sub}>{OWNER_LABEL[task.owner ?? ""] ?? task.owner ?? "Owner not set"}{task.required === false ? " · optional" : ""}</span>
                          </li>
                        ))}
                      </ol>
                    </Panel>
                  );
                })}
              </div>
            )}
      {editing && <TemplateEditor template={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void templates.mutate(); }} />}
    </div>
  );
}

const OWNERS = ["hr", "it", "payroll", "manager", "finance", "facilities"];

function TemplateEditor({ template, onClose, onSaved }: { template: Template | null; onClose: () => void; onSaved: () => void }) {
  const notify = useNotify();
  const [code, setCode] = useState(template?.attributes.code ?? "");
  const [name, setName] = useState(template?.attributes.name ?? "");
  const [tasks, setTasks] = useState<TemplateTask[]>(() => (template?.attributes.tasks ?? []).map((task, index) => ({
    key: task.key ?? task.code ?? `step-${index + 1}`, title: task.title ?? "", required: task.required ?? true, owner: task.owner ?? "hr",
  })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const update = (index: number, patch: Partial<TemplateTask>) => setTasks((list) => list.map((task, position) => (position === index ? { ...task, ...patch } : task)));
  const move = (index: number, delta: number) => setTasks((list) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    return next;
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (!template && !code.trim()) next.code = "Enter a short code, for example PLANT-STD.";
    if (!name.trim()) next.name = "Enter a name.";
    if (tasks.length === 0) next.tasks = "Add at least one step.";
    if (tasks.some((task) => !task.title.trim())) next.tasks = "Every step needs a title.";
    setErrors(next);
    if (Object.keys(next).length) return;
    // Keys must be unique within the checklist; new steps get one from their title.
    const seen = new Set<string>();
    const clean = tasks.map((task) => {
      let key = task.key || taskKey(task.title);
      while (seen.has(key)) key = `${key}-2`;
      seen.add(key);
      return { ...task, key, title: task.title.trim() };
    });
    setSaving(true);
    setFailure(null);
    try {
      if (template) await updateTemplate(template.id, { name: name.trim(), tasks: clean });
      else await createTemplate({ code: code.trim().toUpperCase(), name: name.trim(), tasks: clean });
      notify.success(template ? "Checklist saved" : "Checklist created", name.trim());
      onSaved();
    } catch (cause) {
      setFailure((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onOpenChange={(next) => { if (!next) onClose(); }} title={template ? "Edit checklist" : "New onboarding checklist"}
      description="Changes apply to onboardings started from now on; joiners already in progress keep their steps."
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" form="template-form" loading={saving}>Save</Button></>}>
      <form id="template-form" className={styles.form} onSubmit={(event) => void submit(event)} noValidate>
        {failure && <Alert tone="danger">{failure}</Alert>}
        <div className={styles.formRow}>
          <Field id="tpl-code" label="Code" required={!template} error={errors.code} hint={template ? "The code cannot change." : undefined}>
            <Input id="tpl-code" maxLength={40} value={code} disabled={Boolean(template)} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <Field id="tpl-name" label="Name" required error={errors.name}>
            <Input id="tpl-name" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
        </div>
        <fieldset className={styles.steps}>
          <legend className={styles.drawerHeading}>Steps</legend>
          {errors.tasks && <span className={styles.fieldError}>{errors.tasks}</span>}
          {tasks.map((task, index) => (
            <div key={index} className={styles.stepRow}>
              <Input aria-label={`Step ${index + 1} title`} maxLength={200} value={task.title} placeholder="For example: Laptop and access card" onChange={(event) => update(index, { title: event.target.value })} />
              <Select aria-label={`Step ${index + 1} owner`} value={task.owner} onChange={(event) => update(index, { owner: event.target.value })}>
                {[...new Set([...OWNERS, task.owner])].map((owner) => <option key={owner} value={owner}>{OWNER_LABEL[owner] ?? owner}</option>)}
              </Select>
              <label className={styles.checkLabel}><input type="checkbox" checked={task.required} onChange={(event) => update(index, { required: event.target.checked })} />Required</label>
              <span className={styles.stepButtons}>
                <IconButton label="Move up" icon={ArrowUp} variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)} />
                <IconButton label="Move down" icon={ArrowDown} variant="ghost" size="sm" disabled={index === tasks.length - 1} onClick={() => move(index, 1)} />
                <IconButton label="Remove step" icon={Trash2} variant="ghost" size="sm" onClick={() => setTasks((list) => list.filter((_, position) => position !== index))} />
              </span>
            </div>
          ))}
          <Button icon={Plus} onClick={() => setTasks((list) => [...list, { key: "", title: "", required: true, owner: "hr" }])} disabled={tasks.length >= 30}>Add step</Button>
        </fieldset>
      </form>
    </Drawer>
  );
}
