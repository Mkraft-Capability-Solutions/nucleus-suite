"use client";

import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { canAccessNavigationItem, navigationCatalog } from "@/lib/navigation-catalog";
import { useWorkspace } from "./workspace-provider";

/**
 * Navigation guard for every /<module> route.
 *
 * WHAT THIS IS
 * A client-side check that the signed-in principal is allowed to *navigate* to
 * this module, using exactly the rule that decides whether the module appears
 * in the menus (`canAccessNavigationItem`). One rule, two readers, so a module
 * can never be absent from the sidebar and still render when its URL is typed.
 *
 * WHAT THIS IS NOT
 * This is NOT access control. Permissions arrive over the client workspace
 * bootstrap, so everything here runs in the browser and a determined caller can
 * ignore it. What actually protects data is each page's own API calls: every
 * service in src/server enforces its permission on the request. The guard stops
 * an employee walking into a screen that is not theirs; it does not stop
 * anybody reading data they were not going to be served anyway.
 */
export function ModuleAccessGuard({ module, children }: { module: string; children: React.ReactNode }) {
  const { workspace, loading } = useWorkspace();

  // Never flash the page first. Until the workspace context has resolved we do
  // not know who the reader is, and rendering the module "optimistically" would
  // show an employee a screen we are about to take away.
  if (loading || !workspace) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    );
  }

  const permissions = workspace.context?.permissions ?? [];
  const roles = workspace.context?.roles ?? [];
  const item = navigationCatalog.find((entry) => entry.id === module);
  if (item && canAccessNavigationItem(item, permissions, roles)) return <>{children}</>;

  // A calm dead end inside the app shell: no crash, no redirect, no blank page.
  // The reader keeps the sidebar and the rail, and is offered the one route we
  // know is theirs.
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full border border-border bg-secondary text-muted-foreground">
        <ShieldOff className="size-5" aria-hidden />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-heading text-lg font-semibold text-foreground">This module is not available for your role</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {item
            ? `“${item.label}” is not part of your workspace. If you need it, ask your HR or workspace administrator to review your access.`
            : "This address does not match any module in your workspace. It may have been renamed or removed."}
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Back to your home
      </Link>
    </div>
  );
}
