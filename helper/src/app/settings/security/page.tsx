"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Laptop, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { AppShell } from "@/components/hrms/app-shell";
import { PageIntro, Surface } from "@/components/hrms/page-primitives";
import { WorkspaceProvider } from "@/components/hrms/workspace-provider";
import { authClient } from "@/lib/auth-client";

type SessionItem = {
  token: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
};

export default function SecuritySettingsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function refreshSessions() {
    const result = await authClient.listSessions();
    if (result.error) {
      setError(result.error.message ?? "Could not load active sessions.");
      return;
    }
    setSessions((result.data ?? []) as SessionItem[]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshSessions(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("confirmPassword") ?? "")) {
      setError("The new passwords do not match.");
      setPending(false);
      return;
    }
    const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    if (result.error) {
      setError(result.error.message ?? "Password change failed.");
    } else {
      event.currentTarget.reset();
      setMessage("Password changed. Other sessions were revoked.");
      await refreshSessions();
    }
    setPending(false);
  }

  async function revoke(token: string) {
    setError("");
    const result = await authClient.revokeSession({ token });
    if (result.error) setError(result.error.message ?? "Could not revoke that session.");
    else await refreshSessions();
  }

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <WorkspaceProvider>
      <AppShell>
        <div className="mx-auto max-w-5xl">
        <PageIntro eyebrow="Settings · Security" title="Password and sessions" description="Change your password and revoke devices through the live authentication service." action={<button type="button" onClick={() => void signOut()} className="h-10 rounded-lg border border-destructive/30 px-3 text-[12px] font-bold text-destructive">Sign out here</button>} />
        {(message || error) && <div role={error ? "alert" : "status"} className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-[12px] ${error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-success/25 bg-success/10 text-success"}`}><CheckCircle2 className="size-4" />{error || message}</div>}
        <div className="grid gap-4 lg:grid-cols-2">
          <Surface><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span><div><h2 className="font-heading text-[15px] font-semibold">Change password</h2><p className="text-[12px] text-muted-foreground">Changing it revokes your other active sessions.</p></div></div><form onSubmit={changePassword} className="mt-5 grid gap-3">{[["currentPassword","Current password"],["newPassword","New password (12–128 characters)"],["confirmPassword","Confirm new password"]].map(([name,placeholder]) => <input key={name} name={name} type="password" autoComplete={name === "currentPassword" ? "current-password" : "new-password"} required minLength={name === "currentPassword" ? undefined : 12} maxLength={128} placeholder={placeholder} className="h-10 rounded-lg border border-border bg-secondary px-3 text-[13px] placeholder:text-muted-foreground focus:border-ring" />)}<button disabled={pending} className="mt-1 h-10 rounded-lg bg-primary font-heading text-[13px] font-semibold text-primary-foreground disabled:opacity-60">{pending ? "Updating securely…" : "Update password"}</button></form></Surface>
          <Surface><div className="flex items-center justify-between"><div><h2 className="font-heading text-[15px] font-semibold">Active sessions</h2><p className="mt-1 text-[12px] text-muted-foreground">Authenticated devices returned by Better Auth.</p></div><span className="text-[11px] font-bold text-primary">{sessions.length} active</span></div><div className="mt-4 divide-y divide-border">{sessions.map((session) => <div key={session.token} className="flex items-center gap-3 py-4"><span className="grid size-9 place-items-center rounded-lg border border-border bg-secondary text-info">{session.userAgent?.toLowerCase().includes("mobile") || session.userAgent?.toLowerCase().includes("android") ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-bold">{session.userAgent || "Unknown device"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{session.ipAddress || "IP unavailable"} · created {new Date(session.createdAt).toLocaleString()}</p></div><button type="button" onClick={() => void revoke(session.token)} className="grid size-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10" aria-label="Revoke session"><Trash2 className="size-4" /></button></div>)}{sessions.length === 0 && <p className="py-8 text-center text-[12px] text-muted-foreground">No active sessions were returned.</p>}</div></Surface>
        </div>
        </div>
      </AppShell>
    </WorkspaceProvider>
  );
}
