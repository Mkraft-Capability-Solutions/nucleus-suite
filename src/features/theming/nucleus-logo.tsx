import type { ReactNode } from 'react';
import styles from './brand-logo.module.css';

export interface NucleusLogoProps {
  /** Accessible name (already translated). */
  readonly label: string;
}

/** The Nucleus mark: a nucleus with two orbits, drawn in the active theme's accent. Fallback for tenants without a logo. */
export function NucleusLogo({ label }: NucleusLogoProps): ReactNode {
  return (
    <svg className={styles.mark} viewBox="0 0 32 32" role="img" aria-label={label} focusable="false">
      <rect className={styles.markTile} width="32" height="32" rx="9" />
      <g className={styles.markInk} fill="none" strokeWidth="1.8">
        <ellipse cx="16" cy="16" rx="11" ry="4.6" />
        <ellipse cx="16" cy="16" rx="11" ry="4.6" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="11" ry="4.6" transform="rotate(-60 16 16)" />
      </g>
      <circle className={styles.markCore} cx="16" cy="16" r="2.6" />
    </svg>
  );
}
