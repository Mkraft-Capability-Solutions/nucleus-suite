'use client';
import { useEffect, type RefObject } from 'react';

/** Give overflowing table regions a keyboard focus target without hiding columns. */
export function useScrollableTables(root: RefObject<HTMLElement | null>, enabled: boolean) {
    useEffect(() => {
        const element = root.current;
        if (!enabled || !element) return;
        let frame = 0;
        const enhanced = new Set<HTMLElement>();
        const refresh = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                enhanced.forEach(parent => { if (!element.contains(parent)) clear(parent); });
                element.querySelectorAll('table').forEach(table => {
                    const parent = table.parentElement;
                    if (!parent || !['auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) return;
                    if (parent.scrollWidth > parent.clientWidth + 1 && !parent.hasAttribute('tabindex')) {
                        parent.tabIndex = 0;
                        if (!parent.hasAttribute('role') && !parent.hasAttribute('aria-label')) {
                            parent.setAttribute('role', 'region');
                            parent.setAttribute('aria-label', table.caption?.textContent?.trim() || 'Data table — scroll horizontally for more columns');
                            parent.dataset.scrollRegion = 'true';
                        }
                        enhanced.add(parent);
                    } else if (parent.scrollWidth <= parent.clientWidth + 1 && enhanced.has(parent)) {
                        clear(parent);
                    }
                });
            });
        };
        const clear = (parent: HTMLElement) => {
            parent.removeAttribute('tabindex');
            if (parent.dataset.scrollRegion) {
                parent.removeAttribute('role'); parent.removeAttribute('aria-label'); delete parent.dataset.scrollRegion;
            }
            enhanced.delete(parent);
        };
        const resize = new ResizeObserver(refresh);
        resize.observe(element);
        const mutation = new MutationObserver(refresh);
        mutation.observe(element, { childList: true, subtree: true });
        refresh();
        return () => { resize.disconnect(); mutation.disconnect(); cancelAnimationFrame(frame); enhanced.forEach(clear); };
    }, [root, enabled]);
}
