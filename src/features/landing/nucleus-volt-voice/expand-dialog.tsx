'use client';

/**
 * ExpandDialog: shows the same content larger in a modal <dialog> (showModal: the page behind is inert, so focus is
 * trapped inside; Esc closes; focus returns to the trigger). Opening scales the panel up from the source element's rect
 * (FLIP: translate + scale → identity, 360 ms, quartic ease-out) while the dimmed backdrop fades in; closing plays it
 * back.
 */
import { useCallback, useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from 'react';
import { X } from 'lucide-react';

const DURATION = 360;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

export interface ExpandDialogHandle {
  /** Open, scaling up from `source`; focus returns to `trigger` on close. */
  readonly open: (source: HTMLElement, trigger: HTMLElement) => void;
}

export interface ExpandDialogProps {
  readonly ref: Ref<ExpandDialogHandle>;
  readonly title: string;
  readonly closeLabel: string;
  readonly children: ReactNode;
  readonly onOpenChange?: (open: boolean) => void;
}

export function ExpandDialog({ ref, title, closeLabel, children, onOpenChange }: ExpandDialogProps): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closingRef = useRef(false);

  const fromRect = useCallback((): Keyframe | null => {
    const panel = panelRef.current;
    const source = sourceRef.current;
    if (!panel || !source) return null;
    const a = source.getBoundingClientRect();
    const b = panel.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return null;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const scale = Math.min(a.width / b.width, a.height / b.height);
    return { transform: `translate(${String(dx)}px, ${String(dy)}px) scale(${String(scale)})`, opacity: 0.6 };
  }, []);

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    const panel = panelRef.current;
    if (!dialog?.open || closingRef.current) return;
    const finish = (): void => {
      closingRef.current = false;
      dialog.close();
      onOpenChange?.(false);
      triggerRef.current?.focus();
    };
    const start = fromRect();
    if (!panel || !start) {
      finish();
      return;
    }
    closingRef.current = true;
    dialog.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DURATION, easing: EASE, pseudoElement: '::backdrop' });
    panel.animate([{ transform: 'none', opacity: 1 }, start], { duration: DURATION * 0.8, easing: EASE }).finished.then(finish, finish);
  }, [fromRect, onOpenChange]);

  useImperativeHandle(
    ref,
    () => ({
      open: (source, trigger) => {
        const dialog = dialogRef.current;
        const panel = panelRef.current;
        if (!dialog || !panel || dialog.open) return;
        sourceRef.current = source;
        triggerRef.current = trigger;
        dialog.showModal();
        onOpenChange?.(true);
        const start = fromRect();
        if (!start) return;
        dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION, easing: EASE, pseudoElement: '::backdrop' });
        panel.animate([start, { transform: 'none', opacity: 1 }], { duration: DURATION, easing: EASE });
      },
    }),
    [fromRect, onOpenChange],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    // Esc fires "cancel": play the closing animation instead of the instant close.
    const onCancel = (event: Event): void => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('cancel', onCancel);
    };
  }, [close]);

  return (
    <dialog
      ref={dialogRef}
      className="lp-expand"
      aria-label={title}
      onClick={(event) => {
        // A click on the backdrop (the dialog box itself, outside the panel) closes.
        if (event.target === event.currentTarget) close();
      }}
    >
      <div ref={panelRef} className="lp-expand-panel">
        <button type="button" className="lp-expand-close" onClick={close}>
          <X aria-hidden="true" />
          <span className="visually-hidden">{closeLabel}</span>
        </button>
        {children}
      </div>
    </dialog>
  );
}
