import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { appearanceBootstrap, appearances } from './appearance';

describe('pre-paint appearance restoration', () => {
    for (const theme of appearances) {
        it(`restores ${theme.name} before React mounts`, () => {
            const properties: Record<string, string> = {};
            const root = { dataset: {} as Record<string, string>, style: { colorScheme: '', setProperty: (key: string, value: string) => { properties[key] = value; } } };
            runInNewContext(appearanceBootstrap, { document: { documentElement: root }, localStorage: { getItem: () => theme.id } });
            expect(root.dataset).toEqual({ appearance: theme.id, theme: theme.mode });
            expect(root.style.colorScheme).toBe(theme.mode);
            expect(properties).toEqual(theme.tokens);
        });
    }
    it.each(['legacy', 'blocked', 'invalid'])('handles %s storage without preventing rendering', state => {
        const root = { dataset: {} as Record<string, string>, style: { setProperty() {} } };
        const localStorage = { getItem(key: string) {
            if (state === 'blocked') throw new Error('Storage unavailable');
            if (state === 'invalid') return 'unknown-theme';
            return key === 'nucleus_theme' ? 'dark' : null;
        } };
        expect(() => runInNewContext(appearanceBootstrap, { document: { documentElement: root }, localStorage })).not.toThrow();
        expect(root.dataset.appearance).toBe(state === 'legacy' ? 'dark' : 'light');
    });
});
