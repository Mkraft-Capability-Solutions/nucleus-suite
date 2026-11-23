"use client";

import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "@base-ui/react/menu";
import { AlertCircle, CheckCircle2, Info, Inbox, RotateCw, X, type LucideIcon } from "lucide-react";
import theme from "../theme.module.css";
import ui from "./ui.module.css";

export { ui, theme };

export const cx = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ */
/* Scope root                                                          */
/* ------------------------------------------------------------------ */

/**
 * Root of a redesigned module: every token and style is scoped under it, so nothing reaches
 * modules that keep the classic look. `module` names the module (data-module) for tests and styles.
 */
export function Scope({ children, className, module }: { children: ReactNode; className?: string; module: string }) {
  return <div className={cx(theme.scope, theme.root, className)} data-module={module}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: LucideIcon;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading = false, className, children, disabled, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} className={cx(ui.button, ui[variant], size === "sm" && ui.small, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className={ui.spinner} aria-hidden="true" /> : Icon ? <Icon aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

/** Icon-only button: the label is required and shown as the accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "children"> & { label: string; icon: LucideIcon }>(function IconButton(
  { label, icon: Icon, variant = "ghost", size = "md", className, ...rest }, ref,
) {
  return (
    <button ref={ref} type="button" aria-label={label} title={label} className={cx(ui.button, ui[variant], ui.iconButton, size === "sm" && ui.small, className)} {...rest}>
      <Icon aria-hidden="true" />
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Text, badges, avatar                                                */
/* ------------------------------------------------------------------ */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

export function Badge({ tone = "neutral", children, dot = false }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={cx(ui.badge, ui[`tone-${tone}`])}>{dot && <span className={ui.badgeDot} aria-hidden="true" />}{children}</span>;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("") || "?";
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return <span className={ui.avatar} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">{initials(name)}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={ui.pageHeader}>
      <div className={ui.pageTitleBlock}>
        {eyebrow && <span className={ui.eyebrow}>{eyebrow}</span>}
        <h1 className={ui.pageTitle}>{title}</h1>
        {description && <p className={ui.pageDescription}>{description}</p>}
      </div>
      {actions && <div className={ui.actions}>{actions}</div>}
    </header>
  );
}

/**
 * `highlight`: the one most important item on the page (gradient border); use at most once per page.
 * `fill`: in a screen that fits the viewport, the panel takes the remaining height and its table
 * (or body) scrolls inside it.
 */
export function Panel({ title, subtitle, actions, children, flush = false, as: As = "section", id, highlight = false, fill = false }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean; as?: "section" | "div"; id?: string; highlight?: boolean; fill?: boolean;
}) {
  const headingId = useId();
  return (
    <As className={cx(ui.panel, highlight && ui.highlight, fill && ui.fill)} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || actions) && (
        <div className={ui.panelHeader}>
          <div>
            {title && <h2 id={headingId} className={ui.panelTitle}>{title}</h2>}
            {subtitle && <p className={ui.panelSubtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={ui.actions}>{actions}</div>}
        </div>
      )}
      <div className={flush ? ui.panelBodyFlush : ui.panelBody}>{children}</div>
    </As>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon: Icon = Inbox, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={ui.empty}>
      <span className={ui.emptyIcon}><Icon size={18} aria-hidden="true" /></span>
      <p className={ui.emptyTitle}>{title}</p>
      {children && <p className={ui.emptyText}>{children}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone = "info", children, action }: { tone?: "info" | "danger" | "warning" | "success"; children: ReactNode; action?: ReactNode }) {
  const Icon = tone === "danger" || tone === "warning" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div className={cx(ui.alert, ui[`tone-${tone}`])} role={tone === "danger" ? "alert" : "status"}>
      <Icon aria-hidden="true" />
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Alert tone="danger" action={onRetry ? <Button size="sm" icon={RotateCw} onClick={onRetry}>Try again</Button> : undefined}>{message}</Alert>;
}

export function SkeletonRows({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ padding: "8px 16px", display: "grid", gap: 14 }}>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 16 }}>
          {Array.from({ length: columns }, (_, column) => <span key={column} className={ui.skeleton} style={{ width: `${60 + ((row + column) % 4) * 10}%` }} />)}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Definition list                                                     */
/* ------------------------------------------------------------------ */

export function Details({ items }: { items: Array<{ label: string; value: ReactNode | null | undefined }> }) {
  return (
    <dl className={ui.dl}>
      {items.map((item) => {
        const empty = item.value === null || item.value === undefined || item.value === "";
        return (
          <div className={ui.dlItem} key={item.label}>
            <dt className={ui.dt}>{item.label}</dt>
            <dd className={cx(ui.dd, empty && ui.ddEmpty)}>{empty ? "Not recorded" : item.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/* Form fields                                                         */
/* ------------------------------------------------------------------ */

export function Field({ id, label, required, hint, error, children }: { id: string; label: string; required?: boolean; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className={ui.field}>
      <label className={ui.label} htmlFor={id}>{label}{required && <span className={ui.required} aria-hidden="true">*</span>}</label>
      {children}
      {error ? <span className={ui.error} id={`${id}-error`}><AlertCircle size={12} aria-hidden="true" style={{ marginTop: 2 }} />{error}</span> : hint ? <span className={ui.hint} id={`${id}-hint`}>{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(ui.input, className)} {...rest} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx(ui.select, className)} {...rest} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(ui.textarea, className)} {...rest} />;
});

/* ------------------------------------------------------------------ */
/* Drawer, confirm dialog, menu                                        */
/* ------------------------------------------------------------------ */

export function Drawer({ open, onOpenChange, title, description, children, footer }: {
  open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; description?: ReactNode; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(theme.scope, ui.backdrop)} />
        <Dialog.Popup className={cx(theme.scope, ui.drawer)}>
          <div className={ui.drawerHeader}>
            <div style={{ minWidth: 0 }}>
              <Dialog.Title className={ui.drawerTitle}>{title}</Dialog.Title>
              {description && <Dialog.Description className={ui.drawerDescription}>{description}</Dialog.Description>}
            </div>
            <Dialog.Close className={cx(ui.button, ui.ghost, ui.iconButton)} aria-label="Close"><X aria-hidden="true" /></Dialog.Close>
          </div>
          <div className={ui.drawerBody}>{children}</div>
          {footer && <div className={ui.drawerFooter}>{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Cancel", tone = "primary", onConfirm, onCancel }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; cancelLabel?: string; tone?: "primary" | "danger"; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className={cx(theme.scope, ui.backdrop, ui.dialogBackdrop)} />
        <Dialog.Popup className={cx(theme.scope, ui.dialog)} role="alertdialog">
          <Dialog.Title className={ui.dialogTitle}>{title}</Dialog.Title>
          <Dialog.Description className={ui.dialogText} render={<div />}>{children}</Dialog.Description>
          <div className={ui.actions} style={{ justifyContent: "flex-end", marginTop: 8 }}>
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button variant={tone} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type MenuAction = { label: string; icon?: LucideIcon; onSelect: () => void; disabled?: boolean; separatorBefore?: boolean };

/** A button that opens a list of actions (keyboard and screen-reader accessible). */
export function ActionMenu({ label, trigger, actions, align = "end" }: { label: string; trigger: ReactNode; actions: MenuAction[]; align?: "start" | "end" }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={cx(ui.button, ui.ghost, ui.iconButton, ui.small)} aria-label={label} title={label} onClick={(event) => event.stopPropagation()}>
        {trigger}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={cx(theme.scope, ui.menuPositioner)} align={align} sideOffset={4}>
          <Menu.Popup className={ui.menu}>
            {actions.map((action) => (
              <div key={action.label}>
                {action.separatorBefore && <div className={ui.menuSeparator} role="separator" />}
                <Menu.Item className={ui.menuItem} disabled={action.disabled} onClick={(event) => { event.stopPropagation(); action.onSelect(); }}>
                  {action.icon && <action.icon aria-hidden="true" />}
                  {action.label}
                </Menu.Item>
              </div>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A labelled menu button (e.g. "Export"). */
export function MenuButton({ label, icon: Icon, actions, variant = "secondary" }: { label: string; icon?: LucideIcon; actions: MenuAction[]; variant?: "secondary" | "primary" | "ghost" }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={cx(ui.button, ui[variant])}>
        {Icon && <Icon aria-hidden="true" />}{label}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={cx(theme.scope, ui.menuPositioner)} align="end" sideOffset={4}>
          <Menu.Popup className={ui.menu}>
            {actions.map((action) => (
              <Menu.Item key={action.label} className={ui.menuItem} disabled={action.disabled} onClick={action.onSelect}>
                {action.icon && <action.icon aria-hidden="true" />}{action.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
