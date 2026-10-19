'use client';

/**
 * DeferredHydration: server-renders its children, but on the client keeps that HTML inert (not hydrated, no event
 * handlers) until the wrapper comes within 2 viewports of the screen; then React renders the children for real.
 * This keeps the below-the-fold sections' hydration work off the critical path (Total Blocking Time) while their
 * content stays in the HTML for readers, anchors and search engines.
 *
 * Mechanism: during hydration the client renders the wrapper with an empty dangerouslySetInnerHTML and
 * suppressHydrationWarning, which tells React to adopt the server markup without hydrating it. When the observer fires,
 * state flips and React replaces that markup with a client render of the same tree (identical HTML, so nothing moves).
 * With `preload` (a dynamic import), the children's JavaScript is not even downloaded or evaluated until then.
 */
import { startTransition, useEffect, useRef, useState, type ReactNode } from 'react';
import { reportLandingError } from '../section-kit/report-error';

const EMPTY = { __html: '' } as const;

export interface DeferredHydrationProps {
  readonly children: ReactNode;
  readonly className?: string;
  /** Loads the children's code (a dynamic import) before they render, so the swap never shows a loading state. */
  readonly preload?: () => Promise<unknown>;
  /**
   * `true` (default): the server renders the children and the client adopts that HTML until activation.
   * `false`: server and client render an empty placeholder (one viewport tall, carrying `anchorId` so in-page links
   * still resolve) until activation — no HTML, layout or script cost for the section before it is needed.
   */
  readonly serverRender?: boolean;
  readonly anchorId?: string;
}

export function DeferredHydration({ children, className, preload, serverRender = true, anchorId }: DeferredHydrationProps): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  // Server: render the content. Client (initial render = hydration): adopt the server HTML without hydrating it.
  const [active, setActive] = useState(() => serverRender && typeof window === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (active || !element) return undefined;
    let requested = false;
    // Load the code first, then render in a transition: React keeps the server HTML on screen until the new tree is
    // ready, so the swap is a single commit with identical markup.
    const activate = (): void => {
      if (requested) return;
      requested = true;
      (preload ? preload() : Promise.resolve()).then(
        () => {
          startTransition(() => {
            setActive(true);
          });
        },
        (error: unknown) => {
          // The code failed to load: keep the server-rendered HTML (content stays readable) and report it.
          reportLandingError('deferred-hydration', error);
        },
      );
    };
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) activate();
      },
      { rootMargin: '200% 0px 200% 0px' },
    );
    observer.observe(element);
    // A deep link or in-page jump straight into the section hydrates it at once.
    const onHash = (): void => {
      const target = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null;
      if (target && (target === element || element.contains(target))) activate();
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => {
      observer.disconnect();
      window.removeEventListener('hashchange', onHash);
    };
  }, [active, preload]);

  if (!active && !serverRender) {
    return <div ref={ref} id={anchorId} className={className ? `${className} lp-deferred` : 'lp-deferred'} />;
  }
  if (!active) return <div ref={ref} className={className} suppressHydrationWarning dangerouslySetInnerHTML={EMPTY} />;
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
