"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiGetError, getJson, invalidateGetRequests } from "@/lib/client-api";

export type WorkspaceMembership = {
  membershipId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  employeeId: string | null;
};

export type WorkspaceNotification = {
  id: string;
  attributes: { title?: string; body?: string; read?: boolean; event_type?: string };
  created_at: string;
};

export type WorkspaceData = {
  user: { id: string; name: string; email: string };
  platformAdmin: boolean;
  memberships: WorkspaceMembership[];
  context: { employeeId?: string | null; actorUserId: string; membershipId: string; tenantId: string; roles: string[]; permissions: string[] } | null;
  settings: { locale: string; timezone: string; currency: string; policy_schema_version: number; settings: unknown } | null;
  notifications: { items: WorkspaceNotification[]; unread: number };
};

type WorkspaceContextValue = {
  workspace: WorkspaceData | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function errorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const candidate = payload as { error?: string | { message?: string }; message?: string };
  if (typeof candidate.error === "string") return candidate.error;
  if (candidate.error && typeof candidate.error === "object" && candidate.error.message) return candidate.error.message;
  return candidate.message ?? fallback;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selectDefault = true) => {
    setError("");
    const fetchBootstrap = async () => {
      try {
        const payload = await getJson("/api/v1/workspace/bootstrap") as { data?: WorkspaceData } | null;
        if (!payload?.data) throw new Error("Could not load the workspace.");
        return payload.data;
      } catch (caught) {
        if (caught instanceof ApiGetError && caught.status === 401) {
          router.replace("/login");
          return null;
        }
        throw caught;
      }
    };

    let data = await fetchBootstrap();
    if (!data) return;

    if (selectDefault && !data.context && data.memberships.length > 0) {
      const selected = await fetch("/api/v1/identity/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: data.memberships[0].tenantId }),
      });
      if (!selected.ok) {
        const selectedPayload = await selected.json().catch(() => null);
        throw new Error(errorMessage(selectedPayload, "Could not select the tenant workspace."));
      }
      invalidateGetRequests();
      data = await fetchBootstrap();
      if (!data) return;
    }

    setWorkspace(data);
  }, [router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load the workspace.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const switchTenant = useCallback(async (tenantId: string) => {
    setLoading(true);
    setError("");
    invalidateGetRequests();
    try {
      const response = await fetch("/api/v1/identity/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, "Could not switch tenant."));
      invalidateGetRequests();
      await load(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not switch tenant.");
    } finally {
      setLoading(false);
    }
  }, [load, router]);

  const markNotificationRead = useCallback(async (notificationId: string) => {
    const response = await fetch(`/api/v1/notifications/${notificationId}/read`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(payload, "Could not update the notification."));
    setWorkspace((current) => current ? {
      ...current,
      notifications: {
        unread: Math.max(0, current.notifications.unread - (current.notifications.items.find((item) => item.id === notificationId)?.attributes.read ? 0 : 1)),
        items: current.notifications.items.map((item) => item.id === notificationId
          ? { ...item, attributes: { ...item.attributes, read: true } }
          : item),
      },
    } : current);
  }, []);

  const value = useMemo(() => ({ workspace, loading, error, refresh, switchTenant, markNotificationRead }), [workspace, loading, error, refresh, switchTenant, markNotificationRead]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return value;
}
