"use client";

import { useSyncExternalStore } from "react";
import { ACCENT_EVENT, ACCENT_KEY, DEFAULT_ACCENT, normaliseAccent, type AccentId } from "@/lib/accent";

function snapshot(): AccentId {
  return normaliseAccent(document.documentElement.dataset.accent);
}

function subscribe(callback: () => void) {
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key !== ACCENT_KEY && event.key !== null) return;
    document.documentElement.dataset.accent = normaliseAccent(event.newValue);
    callback();
  };
  window.addEventListener(ACCENT_EVENT, callback);
  window.addEventListener("storage", fromOtherTab);
  return () => {
    window.removeEventListener(ACCENT_EVENT, callback);
    window.removeEventListener("storage", fromOtherTab);
  };
}

export function setAccent(accent: AccentId) {
  const next = normaliseAccent(accent);
  document.documentElement.dataset.accent = next;
  try {
    localStorage.setItem(ACCENT_KEY, next);
  } catch {
    // Storage blocked: the choice still applies to this tab.
  }
  window.dispatchEvent(new Event(ACCENT_EVENT));
}

/** The chosen accent colour, kept in step across components and tabs. */
export function useAccent(): [AccentId, (accent: AccentId) => void] {
  return [useSyncExternalStore(subscribe, snapshot, () => DEFAULT_ACCENT), setAccent];
}
