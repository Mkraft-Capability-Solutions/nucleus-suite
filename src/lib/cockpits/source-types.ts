/** Availability envelope every cockpit feed returns: a value, whether it resolved, why not, and where it came from. */
export type Source<T> = {
  value: T;
  /** True only when the feed resolved. A resolved-but-empty feed is available. */
  available: boolean;
  /** Present when the feed did not resolve; safe to show to the user. */
  message?: string;
  /** Where the figure came from, so a consequential number can state its origin. */
  origin?: string;
};
