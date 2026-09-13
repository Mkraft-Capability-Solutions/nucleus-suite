'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import styles from './PublicMotion.module.css';

const entrances: Record<string, Keyframe[]> = {
    rise: [{ opacity: 0, transform: 'translateY(28px)' }, { opacity: 1, transform: 'none' }],
    scale: [{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }],
    slide: [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }],
    perspective: [{ opacity: 0, transform: 'perspective(1200px) rotateX(5deg) translateY(20px)' }, { opacity: 1, transform: 'none' }],
};

/** Optional motion never controls content visibility, focus or navigation completion. */
export default function PublicMotion({ children, className }: { children: ReactNode; className: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    useEffect(() => {
        const root = ref.current;
        if (!root || !('IntersectionObserver' in window)) return;
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
        const animations = new Set<Animation>();
        let frame = 0;
        let pointerFrame = 0;
        let target: HTMLElement | null = null;
        let bounds: DOMRect | null = null;
        const play = (element: Element, variant: string, delay = 0) => {
            if (preference.matches || typeof element.animate !== 'function') return;
            const animation = element.animate(entrances[variant] ?? entrances.rise, {
                duration: 680, delay, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)',
            });
            animations.add(animation);
            animation.onfinish = animation.oncancel = () => animations.delete(animation);
        };
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                observer.unobserve(entry.target);
                const element = entry.target as HTMLElement;
                if (element.hasAttribute('data-stagger')) {
                    Array.from(element.children).forEach((child, index) => play(child, element.dataset.reveal || 'rise', Math.min(index, 6) * 70));
                } else play(element, element.dataset.reveal || 'rise');
            });
        }, { threshold: 0.12 });
        root.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
        const progress = () => {
            frame = 0;
            const height = document.documentElement.scrollHeight - window.innerHeight;
            root.style.setProperty('--scroll-shift', preference.matches ? '0px' : `${Math.min(18, Math.max(0,window.scrollY)*0.06)}px`);
            root.style.setProperty('--reading-progress', String(height > 0 ? Math.min(1, Math.max(0, window.scrollY / height)) : 0));
        };
        const scroll = () => {
            bounds = null;
            if (!frame) frame = requestAnimationFrame(progress);
        };
        const resetPointer = () => {
            cancelAnimationFrame(pointerFrame);
            pointerFrame = 0;
            if (target) {
                for (const key of ['--pointer-x', '--pointer-y', '--tilt-x', '--tilt-y']) target.style.removeProperty(key);
            }
            target = null;
            bounds = null;
        };
        const move = (event: PointerEvent) => {
            if (preference.matches || !finePointer.matches || event.pointerType === 'touch') return;
            const next = (event.target as Element).closest<HTMLElement>('[data-pointer]');
            if (!next || !root.contains(next)) { resetPointer(); return; }
            if (next !== target) { resetPointer(); target = next; }
            bounds ??= next.getBoundingClientRect();
            const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
            const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
            cancelAnimationFrame(pointerFrame);
            pointerFrame = requestAnimationFrame(() => {
                next.style.setProperty('--pointer-x', `${x * 100}%`);
                next.style.setProperty('--pointer-y', `${y * 100}%`);
                next.style.setProperty('--tilt-x', `${(0.5 - y) * 3}deg`);
                next.style.setProperty('--tilt-y', `${(x - 0.5) * 3}deg`);
                pointerFrame = 0;
            });
        };
        const stop = () => {
            resetPointer();
            progress();
            if (preference.matches) animations.forEach(animation => animation.cancel());
        };
        progress();
        window.addEventListener('scroll', scroll, { passive: true });
        window.addEventListener('resize', scroll);
        root.addEventListener('pointermove', move, { passive: true });
        root.addEventListener('pointerleave', resetPointer);
        preference.addEventListener('change', stop);
        finePointer.addEventListener('change', resetPointer);
        return () => {
            observer.disconnect();
            animations.forEach(animation => animation.cancel());
            cancelAnimationFrame(frame);
            resetPointer();
            window.removeEventListener('scroll', scroll);
            window.removeEventListener('resize', scroll);
            root.removeEventListener('pointermove', move);
            root.removeEventListener('pointerleave', resetPointer);
            preference.removeEventListener('change', stop);
            finePointer.removeEventListener('change', resetPointer);
        };
    }, [pathname]);
    return <div ref={ref} className={`${className} ${styles.motion}`}><div className={styles.progress} aria-hidden="true" />{children}</div>;
}
