"use client";

import { useEffect, useState } from "react";
import type { EntitlementNode } from "@/lib/entitlements/tree";
import EntitlementsEditor from "./EntitlementsEditor";
import { patchEntitlements } from "./client";
import styles from "./Entitlements.module.css";

const PATH = "/api/v1/tenant/entitlements";

type Loaded = { tree: EntitlementNode[]; canManage: boolean; tenantName: string };

/**
 * Settings → Modules & features for the active organisation. Administrators (tenant.manage) switch
 * features and edit settings; modules and sub-modules are shown as the plan the platform set.
 */
export default function TenantModulesPanel() {
  const [state, setState] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`${PATH}?detail=tree`, { cache: "no-store", credentials: "same-origin" })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((body) => {
        if (!active) return;
        setState({ tree: body.data.tree, canManage: Boolean(body.data.canManage), tenantName: body.data.tenant?.name ?? "your organisation" });
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <div className={styles.alert} role="alert">The modules for this organisation could not be loaded.</div>;
  if (!state) return <p className={styles.status} role="status">Loading modules…</p>;
  return (
    <EntitlementsEditor
      tree={state.tree}
      authority="tenant"
      readOnly={!state.canManage}
      intro={
        state.canManage
          ? `Modules and sub-modules are ${state.tenantName}'s plan, set by the platform administrator. You can switch features and change settings inside them.`
          : `${state.tenantName}'s plan. Only organisation administrators can change features and settings.`
      }
      save={(changes) => patchEntitlements(PATH, changes)}
    />
  );
}
