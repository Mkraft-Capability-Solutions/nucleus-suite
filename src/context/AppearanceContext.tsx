'use client';
import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { appearanceFor, applyAppearance, appearanceKey } from '@/lib/appearance';

function snapshot() { return document.documentElement.dataset.appearance || 'light'; }
function subscribe(callback: () => void) {
    const sync = (event: StorageEvent) => {
        if (event.key === appearanceKey || event.key === null) {
            applyAppearance(event.newValue || 'light'); callback();
        }
    };
    window.addEventListener('nucleus:appearance', callback);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('nucleus:appearance', callback); window.removeEventListener('storage', sync); };
}
function selectAppearance(id: string) {
    const selected = applyAppearance(id);
    try { localStorage.setItem(appearanceKey, selected); localStorage.setItem('nucleus_theme', appearanceFor(selected).mode); } catch { /* Preference still applies for this tab. */ }
    window.dispatchEvent(new Event('nucleus:appearance'));
}
const AppearanceContext = createContext({ appearance: appearanceFor('light'), setAppearance: selectAppearance });
export function AppearanceProvider({ children }: { children: ReactNode }) {
    const id = useSyncExternalStore(subscribe, snapshot, () => 'light');
    return <AppearanceContext.Provider value={{ appearance: appearanceFor(id), setAppearance: selectAppearance }}>{children}</AppearanceContext.Provider>;
}
export const useAppearance = () => useContext(AppearanceContext);
