/**
 * Interface mode: Classic (the original look) or Redesigned. Module-aware: a module shows its
 * redesign only when the user chose Redesigned AND the module's redesign is marked completed in
 * REDESIGNED_MODULES. Every other module keeps its classic look in both modes.
 *
 * The choice is a per-browser preference (like the colour appearance), applied before first paint
 * as `html[data-ui-mode]` so there is no flash. Default: classic.
 */

export const UI_MODES = ["classic", "redesigned"] as const;
export type UiMode = (typeof UI_MODES)[number];
export const UI_MODE_KEY = "nucleus_ui_mode";
export const UI_MODE_EVENT = "nucleus:ui-mode";
export const DEFAULT_UI_MODE: UiMode = "classic";

export const UI_MODE_LABELS: Record<UiMode, { name: string; description: string }> = {
  classic: { name: "Classic", description: "The original look, everywhere." },
  redesigned: { name: "Redesigned", description: "The new look in modules that have been redesigned; the rest stay classic." },
};

export type RedesignStatus = "not_started" | "in_progress" | "under_testing" | "completed";

export type RedesignedModule = {
  label: string;
  status: RedesignStatus;
  /** Workspace tabs (MainWorkspace `activeTab`) the redesign replaces. */
  tabs: readonly string[];
};

/** The migration tracker in code. Keep docs/redesign/MODULE_TRACKER.md in step. */
export const REDESIGNED_MODULES: Record<string, RedesignedModule> = {
  core_hr: { label: "Core HR — people and organisation", status: "completed", tabs: ["people_core", "team"] },
  dashboards: { label: "Dashboards — consoles S1–S10", status: "completed", tabs: ["dashboard"] },
  shell: { label: "Shell — top bar, navigation, quick actions", status: "completed", tabs: [] },
};

export function normaliseUiMode(value: unknown): UiMode {
  return value === "redesigned" ? "redesigned" : "classic";
}

/** The redesigned module that owns a workspace tab, if its redesign is complete. */
export function redesignedModuleForTab(tab: string | null | undefined): string | null {
  if (!tab) return null;
  for (const [key, module] of Object.entries(REDESIGNED_MODULES)) {
    if (module.status === "completed" && module.tabs.includes(tab)) return key;
  }
  return null;
}

/** True when this module should render its redesign for the given mode. */
export function usesRedesign(mode: UiMode, moduleKey: string): boolean {
  return mode === "redesigned" && REDESIGNED_MODULES[moduleKey]?.status === "completed";
}

/** Inline script for <head>: sets html[data-ui-mode] before paint. */
export const uiModeBootstrap = `(()=>{try{var m=localStorage.getItem('${UI_MODE_KEY}');document.documentElement.dataset.uiMode=m==='redesigned'?'redesigned':'classic'}catch(e){document.documentElement.dataset.uiMode='classic'}})()`;
