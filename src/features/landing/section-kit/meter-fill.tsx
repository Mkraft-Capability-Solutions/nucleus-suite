'use client';

/**
 * MeterFill: the filled part of a meter. The share (0–100) is mirrored into --w through a ref (no inline style
 * attribute) and CSS draws it with transform: scaleX(var(--w)). With `grow`, a wrapper scales 0 → 1 on the section's
 * entry (data-progress-to, useSectionMotion) while the fill keeps following the value. Decorative: the value is shown
 * as text beside it.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react';

export interface MeterFillProps {
  readonly value: number;
  readonly className?: string;
  readonly grow?: boolean;
}

export function MeterFill({ value, className, grow = false }: MeterFillProps): ReactNode {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--w', String(Math.min(Math.max(value, 0), 100) / 100));
  }, [value]);
  const fill = <i ref={ref} className={className ? `fill ${className}` : 'fill'} aria-hidden="true" />;
  return grow ? (
    <span className="fill-grow" data-progress-to="1" aria-hidden="true">
      {fill}
    </span>
  ) : (
    fill
  );
}
