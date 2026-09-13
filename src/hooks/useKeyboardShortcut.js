'use client';
import { useEffect } from 'react';

/** Register a workspace shortcut only while its owning UI is available. */
export function useKeyboardShortcut(key, onActivate, enabled = true) {
    useEffect(() => {
        if (!enabled) return;
        const handleKey = (event) => {
            if ((event.metaKey || event.ctrlKey || event.altKey) && event.key.toLowerCase() === key.toLowerCase()) {
                event.preventDefault();
                onActivate();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [key, onActivate, enabled]);
}
