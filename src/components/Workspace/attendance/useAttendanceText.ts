"use client";

import { useCallback } from "react";
import { useTranslation } from "@/context/I18nContext";

export const NS = "components.Workspace.AttendanceView";

export type Tr = (key: string, fallback: string, params?: Record<string, string | number>) => string;

/** `tr("text_x", "English")` reads `components.Workspace.AttendanceView.text_x` from the locale files. */
export function useAttendanceText(): { tr: Tr; locale: string } {
  const { t, locale } = useTranslation();
  const tr = useCallback<Tr>((key, fallback, params) => t(`${NS}.${key}`, fallback, params), [t]);
  return { tr, locale };
}

/** Locale-aware date (medium) for an ISO date string; null when absent or invalid. */
export function formatDate(locale: string, iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium" }).format(date);
}

export function formatTime(locale: string, iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale || undefined, { timeStyle: "short" }).format(date);
}
