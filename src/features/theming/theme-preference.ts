/**
 * Appearance preference: which theme and mode the viewer chose, how it is persisted, and the tiny inline script that
 * applies it to <html> before first paint (no flash). Shared by the provider (React) and the root layout (server).
 *
 * Theme ownership: the tenant admin chooses the tenant's theme (TenantBranding.themeId); a stored themeId only exists
 * where a theme picker is offered (tenant admin settings, marketing preview). Every viewer chooses the mode.
 */
import {
  APPROVED_THEME_IDS,
  DEFAULT_MODE_PREFERENCE,
  DEFAULT_THEME_ID,
  MODE_PREFERENCES,
  isModePreference,
  isApprovedThemeId,
  type ModePreference,
  type ThemeId,
} from '@nucleus/design-tokens';

export const APPEARANCE_STORAGE_KEY = 'nucleus.appearance';

export interface AppearancePreference {
  readonly themeId?: ThemeId;
  readonly mode?: ModePreference;
}

/** Parse the stored JSON defensively: unknown or malformed values are ignored, never thrown. */
export function parsePreference(raw: string | null): AppearancePreference {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return {};
    const record = value as Record<string, unknown>;
    // A stored theme only counts while it is approved (pending themes are not offered and are ignored).
    const themeId = isApprovedThemeId(record.themeId) ? record.themeId : undefined;
    const mode = isModePreference(record.mode) ? record.mode : undefined;
    return { ...(themeId ? { themeId } : {}), ...(mode ? { mode } : {}) };
  } catch {
    return {};
  }
}

export function serializePreference(preference: AppearancePreference): string {
  return JSON.stringify(preference);
}

/** The effective theme and mode: the viewer's stored choice, else the tenant's defaults, else the product defaults. */
export function resolvePreference(
  stored: AppearancePreference,
  tenantThemeId: ThemeId | undefined,
  tenantDefaultMode: ModePreference | undefined,
): { readonly themeId: ThemeId; readonly mode: ModePreference } {
  return {
    themeId: stored.themeId ?? tenantThemeId ?? DEFAULT_THEME_ID,
    mode: stored.mode ?? tenantDefaultMode ?? DEFAULT_MODE_PREFERENCE,
  };
}

/**
 * Inline <head> script (runs during HTML parsing, before paint): applies the stored theme/mode to <html>. Under 300
 * bytes; storage errors (private mode, blocked storage) keep the server-rendered defaults.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,p=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_STORAGE_KEY)})||"{}");if(${JSON.stringify(APPROVED_THEME_IDS)}.indexOf(p.themeId)>-1)d.setAttribute("data-theme",p.themeId);if(${JSON.stringify(MODE_PREFERENCES)}.indexOf(p.mode)>-1)d.setAttribute("data-mode",p.mode)}catch(e){}})()`;
