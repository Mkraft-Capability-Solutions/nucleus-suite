import "server-only";

/**
 * Shared data-availability envelope for the dashboard cockpits.
 *
 * A cockpit aggregates many independent feeds, and in a real tenant some of
 * them will be empty, unseeded, or barred to the caller's role. The product
 * rule (DESIGN_SYSTEM.md section 9) is that a surface must never present
 * fabricated or placeholder figures as live data. So every feed reports
 * explicitly whether it resolved, and the client renders an honest empty or
 * unavailable state instead of a zero that looks like a real measurement.
 */

export type Source<T> = {
  value: T;
  /** True only when the feed resolved. A resolved-but-empty feed is available. */
  available: boolean;
  /** Present when the feed did not resolve; safe to show to the user. */
  message?: string;
  /** Where the figure came from, so a consequential number can state its origin. */
  origin?: string;
};

/**
 * Runs one feed, degrading to `fallback` rather than failing the whole cockpit.
 * A cockpit with one broken feed should still render its other nine.
 */
export async function source<T>(
  operation: () => Promise<T>,
  fallback: T,
  origin?: string,
): Promise<Source<T>> {
  try {
    return { value: await operation(), available: true, origin };
  } catch {
    return {
      value: fallback,
      available: false,
      message: "This source is unavailable for your role or is not configured for this tenant.",
      origin,
    };
  }
}

/** Wraps a value that was derived locally rather than fetched. */
export function derived<T>(value: T, origin: string): Source<T> {
  return { value, available: true, origin };
}

/** Marks a feed the platform cannot supply yet, with the reason stated plainly. */
export function unsupported<T>(fallback: T, message: string): Source<T> {
  return { value: fallback, available: false, message };
}

/** Percentage helper that refuses to invent a value when the denominator is zero. */
export function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

/** Rounds to one decimal place, preserving null so "no data" survives the pipeline. */
export function round1(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(1));
}

/** Groups rows by a key and counts them. */
export function countBy<T>(rows: readonly T[], key: (row: T) => string | null | undefined): Array<{ label: string; value: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = key(row);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
