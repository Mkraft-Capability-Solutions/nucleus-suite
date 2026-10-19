/**
 * Landing error reporter (no console): dispatches a `nucleus:error` CustomEvent on window with { source, error }, so a
 * monitoring hook can subscribe in one place. The page itself never shows these details.
 */
export interface LandingErrorDetail {
  readonly source: string;
  readonly error: unknown;
}

export function reportLandingError(source: string, error: unknown): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<LandingErrorDetail>('nucleus:error', { detail: { source, error } }));
}
