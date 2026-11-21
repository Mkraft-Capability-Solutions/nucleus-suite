'use client';
import { useEffect } from 'react';

/** Register a workspace shortcut only while its owning UI is available. */
export function useKeyboardShortcut(key, onActivate, enabled = true) {
    useEffect(() => {
        if (!enabled) return;
        const handleKey = (event) => {
            // event.code as well as event.key: on macOS Option+M types "µ", so the key name alone misses it.
            const matches = event.key.toLowerCase() === key.toLowerCase() || event.code === `Key${key.toUpperCase()}`;
            if ((event.metaKey || event.ctrlKey || event.altKey) && matches) {
                event.preventDefault();
                onActivate();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [key, onActivate, enabled]);
}
