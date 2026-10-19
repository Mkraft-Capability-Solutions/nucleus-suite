'use client';

/**
 * Section navigation (client island): the centred in-page links with aria-current on the section being read, the
 * collapsed menu (native popover) below 1024 px, and the gradient scroll-progress hairline. Progress and the current
 * section are computed from the engine's smoothed scroll, with section tops cached on (re)measure.
 */
import { useId, useRef, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { clamp } from '../motion/scroll-engine';
import { useScene } from '../motion/use-scene';
import { NAV_SECTIONS, type NavSection } from './nav-sections';


/** A section counts as current once its top passes this far below the viewport top (sticky bar + breathing room). */
const ACTIVE_OFFSET = 140;

export interface SectionNavProps {
  readonly label: string;
  readonly menuLabel: string;
  readonly links: readonly { readonly id: NavSection; readonly label: string }[];
  /** Extra actions shown inside the collapsed menu (Log in, primary CTA). */
  readonly children: ReactNode;
}

export function SectionNav({ label, menuLabel, links, children }: SectionNavProps): ReactNode {
  const progressRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const topsRef = useRef<readonly { readonly id: NavSection; readonly top: number }[]>([]);
  /** Document height, cached on measure (reading it per frame would force a layout of the whole page). */
  const heightRef = useRef(0);
  const menuId = useId();
  // Until the reader passes the first linked section, the product tour (Platform) is the current context.
  const [current, setCurrent] = useState<NavSection>(NAV_SECTIONS[0]);

  useScene(
    progressRef,
    (frame) => {
      const bar = progressRef.current;
      if (!bar) return;
      const max = heightRef.current - frame.viewportHeight;
      bar.style.transform = `scaleX(${max > 0 ? clamp(frame.scroll / max) : 0})`;
      let next: NavSection = NAV_SECTIONS[0];
      for (const section of topsRef.current) if (section.top - frame.scroll <= ACTIVE_OFFSET) next = section.id;
      setCurrent((previous) => (previous === next ? previous : next));
    },
    {
      onMeasure: () => {
        heightRef.current = document.documentElement.scrollHeight;
        const tops: { id: NavSection; top: number }[] = [];
        for (const id of NAV_SECTIONS) {
          const section = document.getElementById(id);
          if (section) tops.push({ id, top: section.getBoundingClientRect().top + window.scrollY });
        }
        topsRef.current = tops;
      },
    },
  );

  const list = (onNavigate?: () => void): ReactNode => (
    <ul>
      {links.map((link) => (
        <li key={link.id}>
          <a href={`#${link.id}`} aria-current={current === link.id ? 'location' : undefined} onClick={onNavigate}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <div className="lp-progress" ref={progressRef} aria-hidden="true" />
      <nav className="lp-nav" aria-label={label}>
        {list()}
      </nav>
      <button type="button" className="lp-menu-button" popoverTarget={menuId} aria-label={menuLabel}>
        <Menu aria-hidden="true" />
      </button>
      <nav ref={menuRef} id={menuId} popover="auto" className="lp-menu" aria-label={menuLabel}>
        {list(() => menuRef.current?.hidePopover())}
        <div className="lp-menu-actions">{children}</div>
      </nav>
    </>
  );
}
