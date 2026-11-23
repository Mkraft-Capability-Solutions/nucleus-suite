"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import EntitlementsEditor from "@/components/Entitlements/EntitlementsEditor";
import { patchEntitlements } from "@/components/Entitlements/client";
import { MODULE_CATALOG } from "@/lib/entitlements/catalog";
import type { EntitlementNode } from "@/lib/entitlements/tree";
import styles from "./Platform.module.css";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "archived";
  member_count: number;
  owner_email: string | null;
};

type Member = { membership_id: string; name: string; email: string; status: string; role_codes: string[] };
type Role = { code: string; name: string };
type ApiError = { message: string; details?: Array<{ field: string; issue: string }> };

async function request<T>(url: string, init?: RequestInit): Promise<{ data?: T; error?: ApiError }> {
  try {
    const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { error: { message: body?.error?.message ?? "The request failed.", details: body?.error?.details ?? [] } };
    return { data: body?.data as T };
  } catch {
    return { error: { message: "The server could not be reached. Try again." } };
  }
}

function ErrorAlert({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div className={styles.alert} role="alert">
      {error.message}
      {error.details && error.details.length > 0 && (
        <ul>{error.details.map((detail) => <li key={`${detail.field}-${detail.issue}`}>{detail.issue}</li>)}</ul>
      )}
    </div>
  );
}

/** Platform operator console: organisations, their plan (modules → sub-modules → features) and users. */
export default function PlatformConsole({ adminName }: { adminName: string }) {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const [version, setVersion] = useState(0);
  const loadTenants = async () => setVersion((current) => current + 1);

  useEffect(() => {
    let active = true;
    void request<Tenant[]>("/api/v1/platform/tenants").then((result) => {
      if (!active) return;
      if (result.error) setError(result.error);
      else setTenants(result.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [version]);

  const current = tenants?.find((tenant) => tenant.id === selected) ?? null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Platform console</h1>
          <p className={styles.muted}>Signed in as {adminName}. Organisations, their modules and features, and their users.</p>
        </div>
        <Link className={styles.buttonSecondary} href="/workspace">Open workspace</Link>
      </header>

      <ErrorAlert error={error} />

      <div className={styles.layout}>
        <nav className={styles.sidebar} aria-label="Organisations">
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sectionTitle}>Organisations</h2>
            <button type="button" className={styles.buttonPrimary} onClick={() => { setCreating(true); setSelected(null); }}>
              New organisation
            </button>
          </div>
          {!tenants && <p className={styles.muted} role="status">Loading…</p>}
          {tenants?.length === 0 && <p className={styles.muted}>No organisations yet.</p>}
          <ul className={styles.tenantList}>
            {tenants?.map((tenant) => (
              <li key={tenant.id}>
                <button
                  type="button"
                  className={styles.tenantButton}
                  aria-current={tenant.id === selected ? "true" : undefined}
                  onClick={() => { setSelected(tenant.id); setCreating(false); }}
                >
                  <span className={styles.tenantName}>{tenant.name}</span>
                  <span className={styles.muted}>
                    {tenant.slug} · {tenant.member_count} member{tenant.member_count === 1 ? "" : "s"}
                    {tenant.status !== "active" ? ` · ${tenant.status}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className={styles.main}>
          {creating && (
            <CreateTenant
              onCreated={async (id) => {
                await loadTenants();
                setSelected(id);
              }}
            />
          )}
          {current && <TenantDetail key={current.id} tenant={current} onChanged={loadTenants} />}
          {!creating && !current && <p className={styles.muted}>Choose an organisation to manage its modules and users.</p>}
        </main>
      </div>
    </div>
  );
}

function CreateTenant({ onCreated }: { onCreated: (id: string) => Promise<void> }) {
  const optional = MODULE_CATALOG.filter((mod) => mod.tier !== "core");
  const [modules, setModules] = useState<Set<string>>(new Set(optional.filter((mod) => mod.tier === "standard").map((mod) => mod.key)));
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; ownerEmail: string; oneTimePassword: string | null } | null>(null);

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    const result = await request<{ id: string; name: string; ownerEmail: string; oneTimePassword: string | null }>("/api/v1/platform/tenants", {
      method: "POST",
      body: JSON.stringify({
        name: data.get("name"),
        slug: data.get("slug"),
        legalName: data.get("legalName") || undefined,
        ownerName: data.get("ownerName"),
        ownerEmail: data.get("ownerEmail"),
        modules: [...modules],
      }),
    });
    setBusy(false);
    if (result.error) return setError(result.error);
    setCreated(result.data!);
  }

  if (created) {
    return (
      <section className={styles.panel} aria-labelledby="created-title">
        <h2 id="created-title" className={styles.sectionTitle}>{created.name} created</h2>
        {created.oneTimePassword ? (
          <p>
            Temporary password for {created.ownerEmail}: <code className={styles.code}>{created.oneTimePassword}</code>. It is shown once; ask the owner to change it after signing in.
          </p>
        ) : (
          <p>{created.ownerEmail} already had an account and was added as owner.</p>
        )}
        <button type="button" className={styles.buttonPrimary} onClick={() => onCreated(created.id)}>Manage {created.name}</button>
      </section>
    );
  }

  return (
    <form className={styles.panel} aria-labelledby="create-title" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
      <h2 id="create-title" className={styles.sectionTitle}>New organisation</h2>
      <ErrorAlert error={error} />
      <div className={styles.grid}>
        <label className={styles.field}>Name<input className={styles.input} name="name" required minLength={2} maxLength={160} /></label>
        <label className={styles.field}>URL slug<input className={styles.input} name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={3} maxLength={80} placeholder="acme-industries" /></label>
        <label className={styles.field}>Legal name (optional)<input className={styles.input} name="legalName" maxLength={220} /></label>
        <label className={styles.field}>Owner name<input className={styles.input} name="ownerName" required minLength={2} maxLength={120} /></label>
        <label className={styles.field}>Owner email<input className={styles.input} name="ownerEmail" type="email" required /></label>
      </div>
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Modules (core modules are always included)</legend>
        <div className={styles.checkboxes}>
          {optional.map((mod) => (
            <label key={mod.key} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={modules.has(mod.key)}
                onChange={(event) => {
                  const next = new Set(modules);
                  if (event.target.checked) next.add(mod.key);
                  else next.delete(mod.key);
                  setModules(next);
                }}
              />
              {mod.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <button type="submit" className={styles.buttonPrimary} disabled={busy}>{busy ? "Creating…" : "Create organisation"}</button>
      </div>
    </form>
  );
}

function TenantDetail({ tenant, onChanged }: { tenant: Tenant; onChanged: () => Promise<void> }) {
  const [tab, setTab] = useState<"modules" | "users">("modules");
  const [tree, setTree] = useState<EntitlementNode[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const base = `/api/v1/platform/tenants/${tenant.id}`;

  useEffect(() => {
    void request<{ tree: EntitlementNode[] }>(`${base}/entitlements`).then((result) => {
      if (result.error) setError(result.error);
      else setTree(result.data!.tree);
    });
  }, [base]);

  async function changeStatus(status: "active" | "suspended") {
    setBusy(true);
    setError(null);
    const result = await request(base, { method: "PATCH", body: JSON.stringify({ status, reason }) });
    setBusy(false);
    if (result.error) return setError(result.error);
    setReason("");
    await onChanged();
  }

  return (
    <section className={styles.panel} aria-labelledby="tenant-title">
      <div className={styles.tenantHeader}>
        <div>
          <h2 id="tenant-title" className={styles.sectionTitle}>{tenant.name}</h2>
          <p className={styles.muted}>{tenant.slug} · {tenant.status}{tenant.owner_email ? ` · owner ${tenant.owner_email}` : ""}</p>
        </div>
        <div className={styles.statusForm}>
          <label className={styles.field}>
            Reason for status change
            <input className={styles.input} value={reason} onChange={(event) => setReason(event.target.value)} minLength={8} maxLength={500} placeholder="At least 8 characters" />
          </label>
          {tenant.status === "active" ? (
            <button type="button" className={styles.buttonDanger} disabled={busy || reason.trim().length < 8} onClick={() => changeStatus("suspended")}>Suspend</button>
          ) : (
            <button type="button" className={styles.buttonSecondary} disabled={busy || reason.trim().length < 8} onClick={() => changeStatus("active")}>Reactivate</button>
          )}
        </div>
      </div>
      <ErrorAlert error={error} />

      <div className={styles.tabs} role="tablist" aria-label={`${tenant.name} settings`}>
        <button type="button" role="tab" aria-selected={tab === "modules"} className={styles.tab} onClick={() => setTab("modules")}>Modules & features</button>
        <button type="button" role="tab" aria-selected={tab === "users"} className={styles.tab} onClick={() => setTab("users")}>Users</button>
      </div>

      {tab === "modules" && (tree ? (
        <EntitlementsEditor
          tree={tree}
          authority="platform"
          intro="Switch modules, sub-modules and features for this organisation and set their defaults. Switching something off keeps its data; it returns when switched back on."
          save={(changes) => patchEntitlements(`${base}/entitlements`, changes)}
        />
      ) : !error && <p className={styles.muted} role="status">Loading modules…</p>)}

      {tab === "users" && <TenantUsers base={base} active={tenant.status === "active"} onChanged={onChanged} />}
    </section>
  );
}

function TenantUsers({ base, active, onChanged }: { base: string; active: boolean; onChanged: () => Promise<void> }) {
  const [data, setData] = useState<{ roles: Role[]; members: Member[] } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [roles, setRoles] = useState<Set<string>>(new Set(["employee"]));
  const [created, setCreated] = useState<{ email: string; oneTimePassword: string | null } | null>(null);
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0);
  const load = async () => setVersion((current) => current + 1);

  useEffect(() => {
    let active = true;
    void request<{ roles: Role[]; members: Member[] }>(`${base}/users`).then((result) => {
      if (!active) return;
      if (result.error) setError(result.error);
      else setData(result.data!);
    });
    return () => {
      active = false;
    };
  }, [base, version]);

  async function submit(form: HTMLFormElement) {
    const values = new FormData(form);
    setBusy(true);
    setError(null);
    const result = await request<{ email: string; oneTimePassword: string | null }>(`${base}/users`, {
      method: "POST",
      body: JSON.stringify({ name: values.get("name"), email: values.get("email"), roleCodes: [...roles] }),
    });
    setBusy(false);
    if (result.error) return setError(result.error);
    setCreated(result.data!);
    form.reset();
    await load();
    await onChanged();
  }

  async function resetPassword(member: Member) {
    setBusy(true);
    setError(null);
    const result = await request<{ email: string; oneTimePassword: string }>(`${base}/users/${member.membership_id}/password`, { method: "POST", body: "{}" });
    setBusy(false);
    if (result.error) return setError(result.error);
    setCreated(result.data!);
  }

  if (!data) return error ? <ErrorAlert error={error} /> : <p className={styles.muted} role="status">Loading users…</p>;
  return (
    <div className={styles.stack}>
      <table className={styles.table}>
        <caption className={styles.caption}>Members</caption>
        <thead>
          <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Roles</th><th scope="col">Status</th><th scope="col"><span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Actions</span></th></tr>
        </thead>
        <tbody>
          {data.members.map((member) => (
            <tr key={member.membership_id}>
              <td data-label="Name">{member.name}</td>
              <td data-label="Email">{member.email}</td>
              <td data-label="Roles">{member.role_codes.join(", ") || "—"}</td>
              <td data-label="Status">{member.status}</td>
              <td data-label="">
                <button type="button" className={styles.buttonSecondary} disabled={busy} onClick={() => void resetPassword(member)}>
                  Reset password
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form className={styles.stack} aria-labelledby="add-user-title" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <h3 id="add-user-title" className={styles.subTitle}>Add a user</h3>
        <ErrorAlert error={error} />
        {created && (
          <p className={styles.notice} role="status">
            {created.oneTimePassword ? <>Temporary password for {created.email}: <code className={styles.code}>{created.oneTimePassword}</code> (shown once).</> : <>{created.email} already had an account and was added.</>}
          </p>
        )}
        {!active && <p className={styles.muted}>Reactivate the organisation before adding users.</p>}
        <div className={styles.grid}>
          <label className={styles.field}>Name<input className={styles.input} name="name" required minLength={2} maxLength={120} /></label>
          <label className={styles.field}>Email<input className={styles.input} name="email" type="email" required /></label>
        </div>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Roles</legend>
          <div className={styles.checkboxes}>
            {data.roles.map((role) => (
              <label key={role.code} className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={roles.has(role.code)}
                  onChange={(event) => {
                    const next = new Set(roles);
                    if (event.target.checked) next.add(role.code);
                    else next.delete(role.code);
                    setRoles(next);
                  }}
                />
                {role.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <button type="submit" className={styles.buttonPrimary} disabled={busy || !active || roles.size === 0}>{busy ? "Adding…" : "Add user"}</button>
        </div>
      </form>
    </div>
  );
}
