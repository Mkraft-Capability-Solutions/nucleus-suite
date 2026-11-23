import catalog from '@/config/appearance.json';
export const appearances = catalog.themes;
export type AppearanceId = 'pulse' | 'pulse-light' | 'light' | 'dark' | 'blue' | 'teal';
/** The default appearance is the first catalog entry (Pulse, dark). */
export const defaultAppearance = appearances[0];
/** v2: Pulse became the default (2026-11-23). Earlier stored values were defaults, not choices, so they are not read. */
export const appearanceKey = 'nucleus_appearance_v2';
export function appearanceFor(id: string | null | undefined) {
    return appearances.find(theme => theme.id === id) || appearances[0];
}
/** Called before paint and when the preference changes; never reads HR data. */
export function applyAppearance(id: string) {
    const theme = appearanceFor(id);
    const root = document.documentElement;
    root.dataset.appearance = theme.id;
    root.dataset.theme = theme.mode;
    for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(name, value);
    root.style.colorScheme = theme.mode;
    return theme.id;
}
// The small JSON catalog is the sole source for the pre-paint tokens and React UI.
export const appearanceBootstrap = `(()=>{try{const themes=${JSON.stringify(appearances).replace(/</g, '\\u003c')};let id=themes[0].id;try{id=localStorage.getItem('${appearanceKey}')||themes[0].id}catch{}const t=themes.find(t=>t.id===id)||themes[0];const r=document.documentElement;r.dataset.appearance=t.id;r.dataset.theme=t.mode;r.style.colorScheme=t.mode;Object.entries(t.tokens).forEach(([k,v])=>r.style.setProperty(k,v));}catch{}})()`;
