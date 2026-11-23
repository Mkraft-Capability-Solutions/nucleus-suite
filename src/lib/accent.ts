/**
 * Accent colour of the redesigned interface: the brand colour used for primary buttons, the
 * selected item in navigation, focus and highlights. A per-browser preference (like appearance),
 * applied before first paint as `html[data-accent]`. The tokens for each accent live in
 * src/design/redesign/theme.module.css; Classic is unaffected.
 */

export const ACCENTS = [
  { id: "indigo", name: "Indigo", swatch: "#4338ca" },
  { id: "red", name: "Red", swatch: "#e50914" },
  { id: "sky", name: "Sky", swatch: "#cce5ff" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export const ACCENT_KEY = "nucleus_accent";
export const ACCENT_EVENT = "nucleus:accent";
export const DEFAULT_ACCENT: AccentId = "indigo";

export function normaliseAccent(value: unknown): AccentId {
  return ACCENTS.some((accent) => accent.id === value) ? (value as AccentId) : DEFAULT_ACCENT;
}

/** Inline script for <head>: sets html[data-accent] before paint. */
export const accentBootstrap = `(()=>{try{var a=localStorage.getItem('${ACCENT_KEY}');document.documentElement.dataset.accent=${JSON.stringify(ACCENTS.map((accent) => accent.id))}.indexOf(a)>=0?a:'${DEFAULT_ACCENT}'}catch(e){document.documentElement.dataset.accent='${DEFAULT_ACCENT}'}})()`;
