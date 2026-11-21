"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_UI_MODE, normaliseUiMode, UI_MODE_EVENT, UI_MODE_KEY, usesRedesign, type UiMode } from "@/lib/ui-mode";

function snapshot(): UiMode {
  return normaliseUiMode(document.documentElement.dataset.uiMode);
}

function subscribe(callback: () => void) {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key !== UI_MODE_KEY && event.key !== null) return;
    document.documentElement.dataset.uiMode = normaliseUiMode(event.newValue);
    callback();
  };
  window.addEventListener(UI_MODE_EVENT, callback);
  window.addEventListener("storage", fromOtherTab);
  return () => {
    window.removeEventListener(UI_MODE_EVENT, callback);
    window.removeEventListener("storage", fromOtherTab);
  };
}

function selectUiMode(mode: UiMode) {
  const next = normaliseUiMode(mode);
  document.documentElement.dataset.uiMode = next;
  try {
    localStorage.setItem(UI_MODE_KEY, next);
  } catch {
    // Storage blocked: the choice still applies to this tab.
  }
  window.dispatchEvent(new Event(UI_MODE_EVENT));
}

type UiModeValue = { mode: UiMode; setMode: (mode: UiMode) => void; isRedesigned: (moduleKey: string) => boolean };

const UiModeContext = createContext<UiModeValue>({ mode: DEFAULT_UI_MODE, setMode: selectUiMode, isRedesigned: () => false });

export function UiModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_UI_MODE);
  const isRedesigned = useCallback((moduleKey: string) => usesRedesign(mode, moduleKey), [mode]);
  const value = useMemo(() => ({ mode, setMode: selectUiMode, isRedesigned }), [mode, isRedesigned]);
  return <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>;
}

export const useUiMode = () => useContext(UiModeContext);
