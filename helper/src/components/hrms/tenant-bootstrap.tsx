"use client";

import { useEffect } from "react";

/**
 * Ensures the workspace has an active tenant scope: loads memberships and
 * selects the first active tenant when no scope cookie is set yet.
 * Silent and additive: renders nothing.
 */
export function TenantBootstrap() {
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const contextResponse = await fetch("/api/v1/identity/context", { cache: "no-store" });
        if (!contextResponse.ok) return;
        const contextBody = (await contextResponse.json()) as { context?: { tenantId: string } };
        if (cancelled || contextBody.context?.tenantId) return;
        const membershipsResponse = await fetch("/api/v1/identity/memberships", { cache: "no-store" });
        if (!membershipsResponse.ok) return;
        const membershipsBody = (await membershipsResponse.json()) as { memberships?: Array<{ tenantId: string }> };
        const first = membershipsBody.memberships?.[0]?.tenantId;
        if (!first) return;
        await fetch("/api/v1/identity/context", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tenantId: first }),
        });
      } catch {
        // Workspace remains usable without a tenant scope; pages fall back safely.
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
