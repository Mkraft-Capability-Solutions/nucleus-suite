"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { operationalResources } from "@/lib/operational-catalog";
import { permitted, workflowOperations } from "@/lib/workflow-catalog";
import { OperationForm } from "./workflow-workspace";
import { useWorkspace } from "./workspace-provider";

/**
 * Opens a catalog-driven create form in a dialog.
 *
 * Creating a record used to mean navigating away to
 * `/<module>?section=operations/<resource>`, which lost the reader's place on
 * the page they were working in. This keeps them where they are.
 *
 * The form itself is the SAME `OperationForm` the section workspace renders, so
 * field definitions, validation, the idempotency key and the optimistic
 * concurrency precondition all stay in one implementation. Nothing about the
 * create contract is re-stated here.
 *
 * The trigger renders only when the signed-in principal actually holds the
 * permission for that create operation — matching how the old link behaved.
 */
export function OperationCreateDialog({
  resource,
  label,
  onCreated,
  variant = "primary",
  className,
  title,
  description,
}: {
  /** Catalog resource key, e.g. "rosters", "shifts", "tasks". */
  resource: string;
  /** Trigger label, e.g. "New roster". */
  label: string;
  /** Called after a successful create so the caller can refresh its list. */
  onCreated?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
  /** Dialog heading; defaults to the trigger label. */
  title?: string;
  description?: string;
}) {
  const { workspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const permissions = useMemo(() => workspace?.context?.permissions ?? [], [workspace?.context?.permissions]);

  const definition = operationalResources[resource];

  // The create operation is the POST on the collection path: no "[id]" segment.
  const operation = useMemo(() => {
    const section = `operations/${resource}`;
    return workflowOperations.find(
      (item) => item.section === section && item.method === "POST" && !item.path.includes("[") && permitted(item, permissions),
    );
  }, [resource, permissions]);

  const handleSaved = useCallback(() => {
    setOpen(false);
    onCreated?.();
  }, [onCreated]);

  // No permission, or no such resource: render nothing rather than a control
  // that would fail on submit.
  if (!definition || !operation) return null;

  const trigger = cn(
    "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors duration-150",
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-border text-foreground hover:bg-secondary",
    className,
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={trigger}>
        <Plus className="size-4" />
        {label}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-[var(--scrim)] backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            // Full-bleed on a phone, a centred panel from sm upward.
            "fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-y-auto bg-popover text-popover-foreground shadow-[var(--shadow-overlay)]",
            "transition duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(88vh,760px)] sm:min-h-0 sm:w-[min(680px,calc(100vw-48px))]",
            "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-border",
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="font-heading text-base font-semibold">
                {title ?? label}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-[21px] text-muted-foreground">
                {description ?? `Creates a ${definition.label.replace(/s$/, "").toLowerCase()} record. It starts in ${definition.initial.replace(/_/g, " ")} and follows the approval route for this register.`}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close without creating"
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground sm:size-9"
            >
              <X className="size-4" />
            </Dialog.Close>
          </header>
          <div className="min-w-0 flex-1 px-5 py-4">
            <OperationForm
              operation={operation}
              selected={null}
              onSaved={handleSaved}
              onClose={() => setOpen(false)}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
