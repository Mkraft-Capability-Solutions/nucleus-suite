"use client";

import { useCallback } from "react";
import { useTranslation } from "@/context/I18nContext";
import type { SeverityTone } from "@/lib/cockpits/nucleus-intelligence-types";
import shared from "../DashboardShared.module.css";
import styles from "./NucleusIntelligence.module.css";

/** Shared formatting for the Nucleus Intelligence screen. */

export const NS = "components.Dashboard.Views.NucleusIntelligence";

/** Turns a recorded enum word (`changes_requested`) into readable text when no translation exists. */
export function humanise(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : value;
}

/** The recorded word always travels inside the badge; the tone only reinforces it. */
export function toneBadge(tone: SeverityTone): string {
  switch (tone) {
    case "danger": return shared.badgeCoral ?? "";
    case "warning": return shared.badgeAmber ?? "";
    case "success": return shared.badgeTeal ?? "";
    case "info": return shared.badgeSky ?? "";
    case "neutral": return styles.badgeNeutral ?? "";
    default: {
      const unreachable: never = tone;
      return unreachable;
    }
  }
}

/** Locale-aware timestamp; a missing timestamp reads as not recorded rather than as a blank. */
export function useStamp(): (value: string | null) => string {
  const { t, locale } = useTranslation() as { t: (key: string, fallback: string) => string; locale?: string };
  return useCallback((value: string | null) => {
    if (!value) return t(`${NS}.text_not_recorded`, "Not recorded");
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale || undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  }, [t, locale]);
}
