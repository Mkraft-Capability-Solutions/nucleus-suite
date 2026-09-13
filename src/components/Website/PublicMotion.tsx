'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Progressive enhancement: content remains visible if JavaScript or animation fails. */
export default function PublicMotion({ children, className }: { children: ReactNode; className: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const root = ref.current;
        if (!root || !('IntersectionObserver' in window)) return;
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const animations = new Set<Animation>();
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                if (preference.matches || typeof entry.target.animate !== 'function') return;
                const animation = entry.target.animate([
                    { opacity: 0, transform: 'translateY(24px)' },
                    { opacity: 1, transform: 'translateY(0)' },
                ], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
                animations.add(animation);
                animation.onfinish = () => animations.delete(animation);
            });
        }, { threshold: 0.08 });
        root.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
        const stop = () => { if (preference.matches) animations.forEach(animation => animation.cancel()); };
        preference.addEventListener('change', stop);
        return () => { observer.disconnect(); animations.forEach(animation => animation.cancel()); preference.removeEventListener('change', stop); };
    }, []);
    return <div ref={ref} className={className}>{children}</div>;
}
