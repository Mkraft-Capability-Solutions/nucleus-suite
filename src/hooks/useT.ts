"use client";

import { useTranslation } from "@/context/I18nContext";

/** `t("<namespace>.<key>", "English fallback", { params })` with a precise signature, plus the active locale. */
export type Translate = (key: string, fallback: string, params?: Record<string, string | number>) => string;

export function useT(): { t: Translate; locale: string } {
  const { t, locale } = useTranslation();
  return { t: t as unknown as Translate, locale: locale || "en" };
}
