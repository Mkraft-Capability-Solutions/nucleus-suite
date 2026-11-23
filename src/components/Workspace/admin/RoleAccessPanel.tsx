"use client";

import { useMemo, useState } from "react";
import { Plus, Search, ShieldCheck, Users } from "lucide-react";
import { useResource, type AccessCatalog, type RoleView } from "./adminApi";
import { StateBox, useT } from "./AdminParts";
import CreateRoleDialog from "./CreateRoleDialog";
import RoleEditor from "./RoleEditor";
import styles from "./Admin.module.css";

/**
 * Role panel (rule 4.6): select or create a role, grant page / card / action access and preview what
 * the role sees. Roles come from GET /api/v1/roles, the grantable catalog from GET /api/v1/access/catalog;
 * every change is saved on the server (role_permissions, tenant_settings.roleUiAccess) before the UI updates.
 */

const NS = "components.Workspace.RoleAccessPanel";

export default function RoleAccessPanel({ initialRoleId }: { initialRoleId?: string | null }) {
  const t = useT();
  const roles = useResource<{ items: RoleView[] }>("/api/v1/roles", t(`${NS}.text_roles_failed`, "Roles could not be loaded."));
  const catalog = useResource<AccessCatalog>("/api/v1/access/catalog", t(`${NS}.text_catalog_failed`, "The permission catalog could not be loaded."));
  const [selectedId, setSelectedId] = useState<string | null>(initialRoleId ?? null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState(false);

  const items = useMemo(() => (roles.state.status === "ready" ? roles.state.data.items : []), [roles.state]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((role) => `${role.name} ${role.code}`.toLowerCase().includes(needle)) : items;
  }, [items, query]);

  const selected = items.find((role) => role.id === selectedId) ?? items.find((role) => !role.superAdmin) ?? items[0] ?? null;
  const activeId = selected?.id ?? null;

  const choose = (id: string) => {
    if (id === activeId) return;
    if (dirty && !window.confirm(t(`${NS}.text_discard_confirm`, "You have unsaved changes for this role. Discard them?"))) return;
    setDirty(false);
    setSelectedId(id);
  };

  if (roles.state.status === "loading" || catalog.state.status === "loading") {
    return <StateBox tone="loading">{t(`${NS}.text_loading`, "Loading roles and permissions…")}</StateBox>;
  }
  if (roles.state.status === "error") {
    return <StateBox tone="error" onRetry={roles.reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{roles.state.message}</StateBox>;
  }
  if (catalog.state.status === "error") {
    return <StateBox tone="error" onRetry={catalog.reload} retryLabel={t(`${NS}.text_retry`, "Retry")}>{catalog.state.message}</StateBox>;
  }

  return (
    <div className={styles.split}>
      <aside className={styles.card} aria-label={t(`${NS}.text_roles`, "Roles")}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}><ShieldCheck size={18} aria-hidden="true" />{t(`${NS}.text_roles`, "Roles")}<span className={styles.count}>{items.length}</span></h3>
          <button type="button" className={styles.btnPrimary} onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden="true" />{t(`${NS}.text_create`, "New role")}
          </button>
        </div>
        <label className={styles.search}>
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t(`${NS}.text_search`, "Search roles")} aria-label={t(`${NS}.text_search`, "Search roles")} />
        </label>
        {items.length === 0 && <StateBox tone="empty">{t(`${NS}.text_empty`, "No roles exist in this organisation yet. Create the first one.")}</StateBox>}
        {items.length > 0 && filtered.length === 0 && <StateBox tone="empty">{t(`${NS}.text_no_match`, "No role matches your search.")}</StateBox>}
        <div className={styles.list}>
          {filtered.map((role) => (
            <button
              key={role.id}
              type="button"
              className={`${styles.listItem} ${role.id === activeId ? styles.listItemActive : ""}`}
              aria-current={role.id === activeId ? "true" : undefined}
              onClick={() => choose(role.id)}
            >
              <span>
                <strong>{role.name}</strong>
                <span className={styles.listMeta}><span className={styles.mono}>{role.code}</span></span>
              </span>
              <span className={styles.badge} title={t(`${NS}.text_members`, "Members")}>
                <Users size={12} aria-hidden="true" />{role.memberCount}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.card} aria-live="polite">
        {selected && catalog.state.status === "ready" ? (
          <RoleEditor
            key={selected.id}
            role={selected}
            catalog={catalog.state.data}
            onDirtyChange={setDirty}
            onSaved={() => { setDirty(false); roles.reload(); }}
          />
        ) : (
          <StateBox tone="empty">{t(`${NS}.text_pick`, "Choose a role to see and change its access.")}</StateBox>
        )}
      </section>

      {creating && catalog.state.status === "ready" && (
        <CreateRoleDialog
          roles={items}
          onClose={() => setCreating(false)}
          onCreated={(role) => { setCreating(false); setDirty(false); setSelectedId(role.id); roles.reload(); }}
        />
      )}
    </div>
  );
}
