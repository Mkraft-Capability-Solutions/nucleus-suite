"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { useAuth } from "@/context/AuthContext";
import { canViewNavigationItem as canViewNavigationItemJs } from "@/lib/navigation-access";

const canViewNavigationItem = canViewNavigationItemJs as (item: { id: string; targetTab: string }, isModuleAllowed: unknown, user: unknown, isNavItemEnabled: (navId: string) => boolean) => boolean;
import { Alert, Button, Drawer, cx, theme, ui } from "@/design/redesign/ui";
import { navTarget } from "./navigation";
import {
  availableActions, DEFAULT_PINS, MAX_PINS, normalisePersona, pinnedActions, runQuickAction, usePreference, type QuickAction,
} from "./quick-actions";
import styles from "./Shell.module.css";

type AuthShape = {
  user?: { role?: string; id?: string; email?: string } | null;
  isModuleAllowed: (moduleKey: string, role?: string, userKey?: string) => boolean;
  isNavItemEnabled: (navId: string) => boolean;
};

/** The member's pinned actions plus what they may pin, with a way to open each. */
export function useQuickActions(openNav: (navId: string) => void) {
  const { user, isModuleAllowed, isNavItemEnabled } = useAuth() as unknown as AuthShape;
  const persona = normalisePersona(user?.role);
  const preference = usePreference<string[]>("quick_actions");
  const available = useMemo(() => availableActions(persona, (navId) => {
    const target = navTarget(navId);
    return Boolean(target) && canViewNavigationItem(target!.item, isModuleAllowed, user, isNavItemEnabled);
  }), [persona, isModuleAllowed, isNavItemEnabled, user]);
  const pinned = useMemo(() => pinnedActions(preference.value, persona, available), [preference.value, persona, available]);
  return {
    persona, available, pinned, customised: preference.value !== null, save: preference.save,
    run: (action: QuickAction) => runQuickAction(action, openNav),
  };
}

/** Lets a member choose which actions to pin (up to 8), or go back to their role's defaults. */
export function CustomiseQuickActions({ open, onClose, quick }: { open: boolean; onClose: () => void; quick: ReturnType<typeof useQuickActions> }) {
  const [selected, setSelected] = useState<string[]>(() => quick.pinned.map((action) => action.id));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length >= MAX_PINS ? current : [...current, id]);

  async function save(ids: string[]) {
    setBusy(true);
    setError("");
    try {
      await quick.save(ids);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your quick actions could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => { if (!next) onClose(); }}
      title="Customise quick actions"
      description={`Choose up to ${MAX_PINS}. They appear in the + menu and on your dashboard, in the order you pick them.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => void save([...DEFAULT_PINS[quick.persona]].filter((id) => quick.available.some((action) => action.id === id)))} disabled={busy}>Use my role&apos;s defaults</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={() => void save(selected)}>Save</Button>
        </>
      }
    >
      <div className={styles.customise}>
        {error && <Alert tone="danger">{error}</Alert>}
        <p className={styles.customiseCount} aria-live="polite">{selected.length} of {MAX_PINS} chosen</p>
        <ul className={styles.customiseList}>
          {quick.available.map((action) => {
            const index = selected.indexOf(action.id);
            const disabled = index < 0 && selected.length >= MAX_PINS;
            return (
              <li key={action.id}>
                <label className={cx(styles.customiseRow, disabled && styles.customiseDisabled)}>
                  <input type="checkbox" checked={index >= 0} disabled={disabled} onChange={() => toggle(action.id)} />
                  <action.icon size={16} aria-hidden="true" />
                  <span>{action.label}</span>
                  {index >= 0 && <span className={styles.customiseOrder} aria-label={`Position ${index + 1}`}>{index + 1}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </Drawer>
  );
}

/** The "+" menu in the top bar. */
export function QuickActionsMenu({ quick, onCustomise }: { quick: ReturnType<typeof useQuickActions>; onCustomise: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger className={cx(ui.button, ui.primary, styles.iconTrigger)} aria-label="Quick actions" title="Quick actions">
        <Plus aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className={cx(theme.scope, ui.menuPositioner)} align="end" sideOffset={6}>
          <Menu.Popup className={cx(ui.menu, styles.menuWide)}>
            <div className={styles.menuHeading}>Quick actions</div>
            {quick.pinned.length === 0 && <div className={styles.menuEmpty}>Nothing pinned yet.</div>}
            {quick.pinned.map((action) => (
              <Menu.Item key={action.id} className={ui.menuItem} onClick={() => quick.run(action)}>
                <action.icon aria-hidden="true" />{action.label}
              </Menu.Item>
            ))}
            <div className={ui.menuSeparator} role="separator" />
            <Menu.Item className={ui.menuItem} onClick={onCustomise}><Pencil aria-hidden="true" />Customise…</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** A row of the pinned actions, for the dashboard. */
export function QuickActionsBar({ quick, onCustomise }: { quick: ReturnType<typeof useQuickActions>; onCustomise: () => void }) {
  if (quick.available.length === 0) return null;
  return (
    <section className={styles.quickBar} aria-labelledby="quick-actions-title">
      <h2 id="quick-actions-title" className={styles.quickTitle}>Quick actions</h2>
      <div className={styles.quickList}>
        {quick.pinned.map((action) => (
          <Button key={action.id} icon={action.icon} onClick={() => quick.run(action)}>{action.label}</Button>
        ))}
        <Button variant="ghost" icon={Pencil} onClick={onCustomise}>Customise</Button>
      </div>
    </section>
  );
}
