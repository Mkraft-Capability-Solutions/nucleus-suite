"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, KeyRound, LayoutGrid, Lock, RotateCcw, Save, Search, SquareStack } from "lucide-react";
import { deriveUiAccess } from "@/lib/access/ui-access-catalog";
import { send, useSubmitKey, type AccessCatalog, type RoleView } from "./adminApi";
import { Notice, useT, useToast } from "./AdminParts";
import { ActionGrid, CardGrid, PageGrid } from "./RoleItemGrids";
import RolePreviewView from "./RolePreview";
import styles from "./Admin.module.css";

const NS = "components.Workspace.RoleEditor";

type Tab = "pages" | "cards" | "actions" | "preview";

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((key) => b.has(key));
}

export default function RoleEditor({ role, catalog, onDirtyChange, onSaved }: {
  role: RoleView;
  catalog: AccessCatalog;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const toast = useToast();
  const uiKey = useSubmitKey();
  const actionKey = useSubmitKey();
  const [tab, setTab] = useState<Tab>("pages");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const held = useMemo(
    () => new Set(role.privileged ? catalog.permissions.map((entry) => entry.key) : role.permissionKeys),
    [role, catalog.permissions],
  );
  const initial = useMemo(() => {
    if (role.uiAccess) return { pages: new Set(role.uiAccess.pages), cards: new Set(role.uiAccess.cards) };
    const derived = deriveUiAccess({ superAdmin: role.superAdmin, permissions: [...held], roleConfigs: [null] });
    return {
      pages: new Set(derived.pages.filter((entry) => entry.visible).map((entry) => entry.key)),
      cards: new Set(derived.cards.filter((entry) => entry.visible).map((entry) => entry.key)),
    };
  }, [role, held]);
  const initialActions = useMemo(() => new Set(role.permissionKeys), [role.permissionKeys]);

  const [pages, setPages] = useState<Set<string>>(initial.pages);
  const [cards, setCards] = useState<Set<string>>(initial.cards);
  const [actions, setActions] = useState<Set<string>>(initialActions);

  const uiDirty = !sameSet(pages, initial.pages) || !sameSet(cards, initial.cards);
  const actionsDirty = !sameSet(actions, initialActions);
  useEffect(() => { onDirtyChange(uiDirty || actionsDirty); }, [uiDirty, actionsDirty, onDirtyChange]);

  const toggle = (setter: (update: (prev: Set<string>) => Set<string>) => void) => (key: string, next: boolean) => {
    setError(null);
    setter((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key); else copy.delete(key);
      return copy;
    });
  };

  const saveUi = async () => {
    const body = { pages: [...pages].sort(), cards: [...cards].sort() };
    setBusy(true);
    setError(null);
    const result = await send<RoleView>(`/api/v1/roles/${role.id}/ui-access`, {
      method: "PUT", body, idempotencyKey: uiKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_save_failed`, "The access could not be saved."),
    });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    uiKey.done();
    toast(t(`${NS}.toast_saved_title`, "Access saved"), t(`${NS}.toast_saved_ui`, "Pages and cards for {role} are saved.", { role: role.name }), "success");
    onSaved();
  };

  const resetUi = async () => {
    if (!window.confirm(t(`${NS}.text_reset_confirm`, "Reset {role} to the pages and cards its permissions allow?", { role: role.name }))) return;
    setBusy(true);
    setError(null);
    const result = await send<RoleView>(`/api/v1/roles/${role.id}/ui-access`, { method: "DELETE", fallback: t(`${NS}.text_save_failed`, "The access could not be saved.") });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    toast(t(`${NS}.toast_saved_title`, "Access saved"), t(`${NS}.toast_reset`, "{role} now follows its permission defaults.", { role: role.name }), "info");
    onSaved();
  };

  const saveActions = async () => {
    const body = {
      grant: [...actions].filter((key) => !initialActions.has(key)).sort(),
      revoke: [...initialActions].filter((key) => !actions.has(key)).sort(),
    };
    setBusy(true);
    setError(null);
    const result = await send<RoleView>(`/api/v1/roles/${role.id}/permissions`, {
      method: "PUT", body, idempotencyKey: actionKey.key(JSON.stringify(body)), fallback: t(`${NS}.text_save_failed`, "The access could not be saved."),
    });
    setBusy(false);
    if (!result.ok) { setError(result.error.message); return; }
    actionKey.done();
    toast(
      t(`${NS}.toast_saved_title`, "Access saved"),
      t(`${NS}.toast_saved_actions`, "{role}: {granted} granted, {revoked} removed. Members get the change on their next request.", { role: role.name, granted: body.grant.length, revoked: body.revoke.length }),
      "success",
    );
    onSaved();
  };

  const locked = role.superAdmin;
  const tabs: Array<[Tab, string, typeof LayoutGrid, number | null]> = [
    ["pages", t(`${NS}.tab_pages`, "Pages"), LayoutGrid, pages.size],
    ["cards", t(`${NS}.tab_cards`, "Dashboard cards"), SquareStack, cards.size],
    ["actions", t(`${NS}.tab_actions`, "Actions"), KeyRound, role.privileged ? catalog.permissions.length : actions.size],
    ["preview", t(`${NS}.tab_preview`, "Preview"), Eye, null],
  ];

  return (
    <>
      <div className={styles.cardHeader}>
        <div>
          <h3 className={styles.cardTitle}>{role.name}</h3>
          <p className={styles.cardSubtitle}>
            <span className={styles.mono}>{role.code}</span>{" · "}
            {t(`${NS}.text_members_count`, "{count} members", { count: role.memberCount })}
            {role.uiAccess ? ` · ${t(`${NS}.text_custom`, "Custom page access")}` : ` · ${t(`${NS}.text_default`, "Pages follow permissions")}`}
          </p>
        </div>
        <div className={styles.row}>
          {role.superAdmin && <span className={`${styles.badge} ${styles.badgeAgent}`}><Lock size={12} aria-hidden="true" />{t(`${NS}.text_super`, "Super admin")}</span>}
          {!role.superAdmin && role.privileged && <span className={`${styles.badge} ${styles.badgeInfo}`}>{t(`${NS}.text_privileged`, "All actions")}</span>}
          {role.systemManaged && <span className={styles.badge}>{t(`${NS}.text_system`, "System role")}</span>}
        </div>
      </div>

      {locked && <Notice tone="info">{t(`${NS}.text_super_note`, "Super admins always see every page and card and may perform every action. This cannot be narrowed.")}</Notice>}

      <div className={styles.tabs} role="tablist" aria-label={t(`${NS}.text_sections`, "Access sections")}>
        {tabs.map(([id, label, Icon, count]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`} onClick={() => setTab(id)}>
            <Icon size={15} aria-hidden="true" />{label}{count !== null && <span className={styles.count}>{count}</span>}
          </button>
        ))}
      </div>

      {tab !== "preview" && (
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(`${NS}.text_filter`, "Filter")} aria-label={t(`${NS}.text_filter`, "Filter")} />
        </label>
      )}

      {tab === "pages" && <PageGrid t={t} pages={catalog.pages} selected={pages} held={held} query={query} disabled={locked || busy} onToggle={toggle(setPages)} />}
      {tab === "cards" && <CardGrid t={t} cards={catalog.cards} selected={cards} held={held} query={query} disabled={locked || busy} onToggle={toggle(setCards)} />}
      {tab === "actions" && (
        <>
          {role.privileged && !role.superAdmin && <Notice tone="info">{t(`${NS}.text_privileged_note`, "This role receives every active permission when its members sign in, so its actions cannot be narrowed here.")}</Notice>}
          <ActionGrid t={t} permissions={catalog.permissions} selected={role.privileged ? held : actions} query={query} disabled={role.privileged || busy} onToggle={toggle(setActions)} />
        </>
      )}
      {tab === "preview" && <RolePreviewView roleId={role.id} version={`${role.permissionKeys.join(",")}|${role.uiAccess?.updatedAt ?? ""}`} />}

      {error && <Notice tone="error">{error}</Notice>}

      {tab !== "preview" && !locked && (
        <div className={styles.footer}>
          <div className={styles.row}>
            {(tab === "pages" || tab === "cards") && role.uiAccess && (
              <button type="button" className={styles.btnSecondary} onClick={() => void resetUi()} disabled={busy}>
                <RotateCcw size={15} aria-hidden="true" />{t(`${NS}.text_reset`, "Reset to permission defaults")}
              </button>
            )}
          </div>
          <div className={styles.row}>
            {(tab === "pages" || tab === "cards") && (
              <button type="button" className={styles.btnPrimary} onClick={() => void saveUi()} disabled={busy || (!uiDirty && Boolean(role.uiAccess))}>
                <Save size={15} aria-hidden="true" />{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_save_ui`, "Save pages and cards")}
              </button>
            )}
            {tab === "actions" && !role.privileged && (
              <button type="button" className={styles.btnPrimary} onClick={() => void saveActions()} disabled={busy || !actionsDirty}>
                <Save size={15} aria-hidden="true" />{busy ? t(`${NS}.text_saving`, "Saving…") : t(`${NS}.text_save_actions`, "Save actions")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
