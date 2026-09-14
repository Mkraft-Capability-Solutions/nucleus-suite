import catalog from '@/config/appearance.json';
export const appearances = catalog.themes;
export type AppearanceId = 'light' | 'dark' | 'blue' | 'teal';
export const appearanceKey = 'nucleus_appearance';
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
export const appearanceBootstrap = `(()=>{try{const themes=${JSON.stringify(appearances).replace(/</g, '\\u003c')};let id='light';try{id=localStorage.getItem('${appearanceKey}')||localStorage.getItem('nucleus_theme')||'light'}catch{}const t=themes.find(t=>t.id===id)||themes[0];const r=document.documentElement;r.dataset.appearance=t.id;r.dataset.theme=t.mode;r.style.colorScheme=t.mode;Object.entries(t.tokens).forEach(([k,v])=>r.style.setProperty(k,v));}catch{}})()`;
