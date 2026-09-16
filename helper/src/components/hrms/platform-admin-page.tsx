"use client";

import { Archive, Building2, CircleAlert, Copy, KeyRound, Loader2, PauseCircle, PlayCircle, Plus, ShieldCheck, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PageIntro, StatusPill, Surface } from "@/components/hrms/page-primitives";

type Tenant = {
  id: string; name: string; slug: string; legal_name: string | null; default_currency: string; timezone: string;
  status: "active" | "suspended" | "archived"; created_at: string; member_count: number; owner_name: string | null; owner_email: string | null;
};
type ProvisionedTenant = { id: string; name: string; slug: string; ownerEmail: string; oneTimePassword: string | null; reusedExistingUser: boolean };
type ProvisionedUser = { tenantName: string; email: string; roleCodes: string[]; oneTimePassword: string | null; reusedExistingUser: boolean };
type CredentialNotice = { title: string; email: string; password: string | null; description: string };

const initialForm = { name: "", legalName: "", slug: "", timezone: "Asia/Kolkata", currency: "INR", ownerName: "", ownerEmail: "" };
const initialUserForm = { tenantId: "", name: "", email: "", roleCodes: "employee" };

function message(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as { error?: { message?: string; details?: unknown } | string; message?: string };
  if (typeof value.error === "string") return value.error;
  if (typeof value.error !== "object" || !value.error) return value.message ?? fallback;
  const base = value.error.message ?? fallback;
  // Field-level validation detail (e.g. "slug must be lowercase") the backend already sends
  // on a 400 — surfaced here too so the user learns which field is wrong, not just that
  // "details are invalid", matching erp-integration-page.tsx's putJson.
  const issues = Array.isArray(value.error.details)
    ? value.error.details.map((issue) => (issue && typeof issue === "object" ? String((issue as { issue?: unknown }).issue ?? "") : "")).filter(Boolean)
    : [];
  return issues.length > 0 ? `${base} ${issues.join(" ")}` : base;
}

export function PlatformAdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [form, setForm] = useState(initialForm);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<CredentialNotice | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  async function fetchTenants(): Promise<Tenant[]> {
    const response = await fetch("/api/v1/platform/tenants", { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { data?: Tenant[] } | null;
    if (!response.ok || !payload?.data) throw new Error(message(payload, "Could not load companies."));
    return payload.data;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTenants(await fetchTenants());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load companies.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchTenants();
        if (!cancelled) setTenants(data);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load companies.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totals = useMemo(() => ({
    companies: tenants.length,
    active: tenants.filter((tenant) => tenant.status === "active").length,
    members: tenants.reduce((sum, tenant) => sum + tenant.member_count, 0),
  }), [tenants]);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/v1/platform/tenants", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, legalName: form.legalName || undefined }) });
      const payload = await response.json().catch(() => null) as { data?: ProvisionedTenant } | null;
      if (!response.ok || !payload?.data) throw new Error(message(payload, "Could not create company."));
      setNotice({ title: `${payload.data.name} is ready`, email: payload.data.ownerEmail, password: payload.data.oneTimePassword, description: payload.data.reusedExistingUser ? "The owner already had an account; no password was changed." : "Save the owner credential now. The temporary password is shown only once." });
      setForm(initialForm);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create company.");
    } finally {
      setCreating(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);
    setError("");
    try {
      const roleCodes = userForm.roleCodes.split(",").map((role) => role.trim()).filter(Boolean);
      const response = await fetch(`/api/v1/platform/tenants/${userForm.tenantId}/users`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: userForm.name, email: userForm.email, roleCodes }) });
      const payload = await response.json().catch(() => null) as { data?: ProvisionedUser } | null;
      if (!response.ok || !payload?.data) throw new Error(message(payload, "Could not create user."));
      setNotice({ title: `${payload.data.email} can access ${payload.data.tenantName}`, email: payload.data.email, password: payload.data.oneTimePassword, description: payload.data.reusedExistingUser ? `Existing account connected with roles: ${payload.data.roleCodes.join(", ")}. Its password was not changed.` : `Save this one-time password. Assigned roles: ${payload.data.roleCodes.join(", ")}.` });
      setUserForm((current) => ({ ...initialUserForm, tenantId: current.tenantId }));
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create user."); }
    finally { setCreatingUser(false); }
  }

  async function changeStatus(tenant: Tenant, status: Tenant["status"]) {
    const verb = status === "archived" ? "archive" : status === "suspended" ? "suspend" : "reactivate";
    const reason = window.prompt(`Reason to ${verb} ${tenant.name} (minimum 8 characters):`);
    if (!reason) return;
    if (reason.trim().length < 8) {
      setError("The reason must be at least 8 characters.");
      return;
    }
    setChanging(tenant.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/platform/tenants/${tenant.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status, reason }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(payload, `Could not ${verb} company.`));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not ${verb} company.`);
    } finally {
      setChanging(null);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard?.writeText(value);
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageIntro eyebrow="Private control plane" title="Platform administration" description="Provision and govern customer workspaces without granting ordinary tenant owners access to platform controls." />
      {error && <div role="alert" className="mb-5 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive"><CircleAlert className="mt-0.5 size-4 shrink-0" />{error}</div>}
      {notice && <div className="mb-5 rounded-xl border border-primary/35 bg-primary/10 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" />{notice.title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{notice.description}</p></div><button type="button" onClick={() => setNotice(null)} className="inline-flex h-10 shrink-0 items-center self-start text-xs text-muted-foreground hover:text-foreground sm:h-auto">Dismiss</button></div>{notice.password && <div className="mt-4 grid gap-2 rounded-lg border border-primary/20 bg-secondary p-3 sm:grid-cols-2"><Credential label="Login email" value={notice.email} onCopy={copy} /><Credential label="One-time password" value={notice.password} onCopy={copy} secret /></div>}</div>}
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Summary icon={Building2} label="Companies" value={totals.companies} /><Summary icon={ShieldCheck} label="Active workspaces" value={totals.active} /><Summary icon={Users} label="Active memberships" value={totals.members} /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,390px)]">
        <Surface className="min-w-0 p-0"><div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Customer companies</h2><p className="mt-1 text-xs text-muted-foreground">Archive preserves audit and workforce history. It does not permanently delete regulated data.</p></div><button type="button" onClick={() => void load()} className="h-10 sm:h-9 rounded-lg border border-border bg-secondary/50 px-3 text-xs text-muted-foreground hover:text-foreground">Refresh</button></div><div className="divide-y divide-border">{loading ? <div className="p-8 text-center text-xs text-muted-foreground"><Loader2 className="mx-auto mb-2 size-4 animate-spin text-primary" />Loading protected company registry…</div> : tenants.length === 0 ? <div className="p-8 text-center text-xs text-muted-foreground">No companies have been provisioned yet.</div> : tenants.map((tenant) => <article key={tenant.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold">{tenant.name}</h3><StatusPill tone={tenant.status === "active" ? "success" : tenant.status === "suspended" ? "warning" : "neutral"}>{tenant.status}</StatusPill></div><p className="mt-1 font-mono text-[11px] text-muted-foreground">{tenant.slug} · {tenant.default_currency} · {tenant.timezone}</p><p className="mt-2 text-xs text-muted-foreground">{tenant.owner_name ?? "No active owner"}{tenant.owner_email ? ` · ${tenant.owner_email}` : ""} · {tenant.member_count} members</p></div><div className="flex flex-wrap gap-2">{tenant.status !== "active" && <Action label="Reactivate" icon={PlayCircle} busy={changing === tenant.id} onClick={() => void changeStatus(tenant, "active")} />} {tenant.status === "active" && <Action label="Suspend" icon={PauseCircle} busy={changing === tenant.id} onClick={() => void changeStatus(tenant, "suspended")} />} {tenant.status !== "archived" && <Action label="Archive" icon={Archive} busy={changing === tenant.id} danger onClick={() => void changeStatus(tenant, "archived")} />}</div></div></article>)}</div></Surface>
        <div className="min-w-0 space-y-5"><Surface className="h-fit p-5"><div className="flex items-center gap-2"><Users className="size-4 text-primary" /><h2 className="text-sm font-semibold">Mint tenant user</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Creates secure login credentials and assigns one or more company roles.</p><form className="mt-5 space-y-3" onSubmit={createUser}><label className="block text-[11px] font-medium"><span className="mb-1.5 block">Company</span><select required value={userForm.tenantId} onChange={(event) => setUserForm((current) => ({ ...current, tenantId: event.target.value }))} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs"><option value="">Select company</option>{tenants.filter((tenant) => tenant.status === "active").map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label><Field label="Full name" value={userForm.name} onChange={(name) => setUserForm((current) => ({ ...current, name }))} placeholder="Maya Rao" required /><Field label="Work email" value={userForm.email} onChange={(email) => setUserForm((current) => ({ ...current, email }))} placeholder="maya@company.com" required type="email" /><Field label="Role codes" value={userForm.roleCodes} onChange={(roleCodes) => setUserForm((current) => ({ ...current, roleCodes }))} placeholder="employee, hr-manager" required /><p className="text-[11px] leading-4 text-muted-foreground">Built-ins: employee, hr-manager, payroll-admin. Separate multiple roles with commas.</p><button disabled={creatingUser} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-60">{creatingUser ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}{creatingUser ? "Creating secure account…" : "Create user and credentials"}</button></form></Surface><Surface className="h-fit p-5"><div className="flex items-center gap-2"><Plus className="size-4 text-primary" /><h2 className="text-sm font-semibold">Create company</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Creates the workspace, owner membership, standard roles, settings, and an audited credential handoff.</p><form className="mt-5 space-y-3" onSubmit={createCompany}><Field label="Company name" value={form.name} onChange={(name) => setForm((current) => ({ ...current, name }))} placeholder="Orion Manufacturing" required /><Field label="URL slug" value={form.slug} onChange={(slug) => setForm((current) => ({ ...current, slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))} placeholder="orion-manufacturing" required /><Field label="Legal name" value={form.legalName} onChange={(legalName) => setForm((current) => ({ ...current, legalName }))} placeholder="Optional" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Timezone" value={form.timezone} onChange={(timezone) => setForm((current) => ({ ...current, timezone }))} placeholder="Asia/Kolkata" required /><Field label="Currency" value={form.currency} onChange={(currency) => setForm((current) => ({ ...current, currency: currency.toUpperCase() }))} placeholder="INR" required /></div><div className="border-t border-border pt-4"><p className="mb-3 font-mono text-[11px] font-semibold tracking-[.13em] text-muted-foreground">INITIAL OWNER</p><Field label="Full name" value={form.ownerName} onChange={(ownerName) => setForm((current) => ({ ...current, ownerName }))} placeholder="Aarav Malhotra" required /><div className="mt-3"><Field label="Work email" value={form.ownerEmail} onChange={(ownerEmail) => setForm((current) => ({ ...current, ownerEmail }))} placeholder="aarav@orion.com" required type="email" /></div></div><button disabled={creating} className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/35 bg-primary/10 text-xs font-semibold text-primary disabled:opacity-60">{creating ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}{creating ? "Provisioning workspace…" : "Create company and owner"}</button></form></Surface></div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; required?: boolean; type?: string }) { return <label className="block text-[11px] font-medium text-foreground"><span className="mb-1.5 block">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary" /></label>; }
function Credential({ label, value, onCopy, secret }: { label: string; value: string; onCopy: (value: string) => Promise<void>; secret?: boolean }) { return <div className="min-w-0"><p className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><div className="mt-1 flex items-center gap-2"><code className={`min-w-0 flex-1 truncate text-xs text-foreground ${secret ? "select-all" : ""}`}>{value}</code><button type="button" onClick={() => void onCopy(value)} className="grid size-10 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:text-primary sm:size-7" aria-label={`Copy ${label}`}><Copy className="size-3" /></button></div></div>; }
function Summary({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number }) { return <Surface className="flex items-center gap-3 p-4"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" /></span><span><span className="block font-mono text-xl font-semibold tabular-nums">{value}</span><span className="block text-[11px] text-muted-foreground">{label}</span></span></Surface>; }
function Action({ label, icon: Icon, busy, danger, onClick }: { label: string; icon: typeof Archive; busy: boolean; danger?: boolean; onClick: () => void }) { return <button type="button" disabled={busy} onClick={onClick} className={`inline-flex h-10 sm:h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] disabled:opacity-50 ${danger ? "border-destructive/25 text-destructive hover:bg-destructive/10" : "border-border text-muted-foreground hover:text-foreground"}`}>{busy ? <Loader2 className="size-3 animate-spin" /> : <Icon className="size-3" />}{label}</button>; }
