"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { newIdempotencyKey, sendJson } from "@/lib/api-mutation";
import { selectData, useApiResource } from "@/hooks/useApiResource";

/** Shape of GET/POST /api/v1/attendance/punches/me (see src/server/attendance/self-punch.ts). */
export type PunchDay = {
  employeeId: string;
  workDate: string;
  timezone: string;
  dayStatus: string | null;
  locked: boolean;
  punches: Array<{ id: string; at: string; type: "in" | "out"; source: string | null }>;
  state: "not_started" | "in" | "out";
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  nextDirection: "in" | "out";
  shift: { code: string | null; name: string | null; startsAt: string | null; endsAt: string | null; graceMinutes: number | null } | null;
  serverTime: string;
};

export const PUNCH_DAY_PATH = "/api/v1/attendance/punches/me";
export const PUNCH_CHANGED_EVENT = "nucleus:punch-recorded";

/**
 * Today's punch day for the signed-in employee, plus `punch()` which posts to the real punch route with one
 * Idempotency-Key per logical punch (reused when the same punch is retried after a network failure).
 */
export function useMyPunchDay() {
  const { state, reload } = useApiResource<PunchDay>(PUNCH_DAY_PATH, selectData);
  const [pending, setPending] = useState(false);
  const pendingKey = useRef<{ direction: "in" | "out"; key: string } | null>(null);

  // Every mounted reader refreshes when any punch control records a punch.
  useEffect(() => {
    window.addEventListener(PUNCH_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PUNCH_CHANGED_EVENT, reload);
  }, [reload]);

  const punch = useCallback(async (direction: "in" | "out", remark?: string) => {
    if (!pendingKey.current || pendingKey.current.direction !== direction) pendingKey.current = { direction, key: newIdempotencyKey() };
    setPending(true);
    const result = await sendJson<PunchDay>(PUNCH_DAY_PATH, {
      idempotencyKey: pendingKey.current.key,
      body: remark?.trim() ? { direction, remark: remark.trim().slice(0, 120) } : { direction },
    });
    setPending(false);
    // A definitive server answer (accepted or refused) ends this logical punch; a network failure keeps the key for retry.
    if (result.ok || result.status !== null) pendingKey.current = null;
    if (result.ok) window.dispatchEvent(new CustomEvent(PUNCH_CHANGED_EVENT, { detail: result.data }));
    return result;
  }, []);

  return { state, reload, punch, pending };
}

/** "8h 05m" style duration without locale-specific words (digits via Intl). */
export function formatMinutes(minutes: number, locale: string): { hours: string; minutes: string } {
  const number = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
  return { hours: new Intl.NumberFormat(locale).format(Math.floor(minutes / 60)), minutes: number.format(minutes % 60) };
}

export function formatClock(iso: string | null, locale: string, timeZone: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  }
}

/** Late when the first IN is after shift start + grace, both read in the facility timezone. Null when unknown. */
export function isLateArrival(day: PunchDay): boolean | null {
  const start = day.shift?.startsAt;
  if (!day.firstIn || !start || !/^\d{1,2}:\d{2}/.test(start)) return null;
  const [h, m] = start.split(":").map(Number);
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: day.timezone }).formatToParts(new Date(day.firstIn));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute > h * 60 + m + (day.shift?.graceMinutes ?? 0);
}
