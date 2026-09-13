import { describe, expect, it, vi } from 'vitest';
import { createWorkspaceDataService, validateWorkspaceData } from '../src/services/workspace-data.mjs';
import { workspaceResources } from '../src/data/workspace-manifest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const payload = { version: 1, resources: { people: { items: [{ id: 'p1', name: 'Test Employee' }] } } };

describe('workspace data service', () => {
    it('coalesces concurrent reads and uses a single loaded snapshot', async () => {
        const transport = vi.fn(async () => payload);
        const service = createWorkspaceDataService(transport);
        await Promise.all([service.load(), service.load(), service.load()]);
        await service.load();
        expect(transport).toHaveBeenCalledTimes(1);
        expect(service.read('people', 'items')[0].name).toBe('Test Employee');
    });
    it('does not expose data before loading or fabricate missing records', async () => {
        const service = createWorkspaceDataService(async () => payload);
        expect(() => service.read('people')).toThrow(/loaded/);
        await service.load();
        expect(() => service.read('missing')).toThrow(/Missing workspace resource/);
        expect(() => service.read('people', 'missing')).toThrow(/Missing workspace field/);
    });
    it('isolates form edits from the cached JSON and other readers', async () => {
        const service = createWorkspaceDataService(async () => payload);
        await service.load();
        const first = service.read('people', 'items');
        first[0].name = 'Edited';
        expect(service.read('people', 'items')[0].name).toBe('Test Employee');
    });
    it('propagates service errors and allows an explicit retry', async () => {
        const transport = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(payload);
        const service = createWorkspaceDataService(transport);
        await expect(service.load()).rejects.toThrow('offline');
        await expect(service.load()).resolves.toEqual(payload);
        expect(transport).toHaveBeenCalledTimes(2);
    });
    it.each([null, {}, { version: 2, resources: {} }, { version: 1, resources: [] }])('rejects invalid envelopes: %j', (value) => {
        expect(() => validateWorkspaceData(value)).toThrow(/unsupported/);
    });
    it('rejects incomplete resources before mounting screens', () => {
        expect(() => validateWorkspaceData(payload, { people: ['missing'] })).toThrow(/incomplete resource/);
        expect(() => validateWorkspaceData(payload, { employees: ['items'] })).toThrow(/incomplete resource/);
    });
    it('resolves every UI data reference against the server JSON manifest', () => {
        const missing: string[] = [];
        function walk(directory: string) {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const file = join(directory, entry.name);
                if (entry.isDirectory()) walk(file);
                else if (/\.(js|mjs)$/.test(file)) {
                    const source = readFileSync(file, 'utf8');
                    for (const match of source.matchAll(/readData\(["']([^"']+)["'](?:, ["']([^"']+)["'])?\)/g)) {
                        const resource = workspaceResources[match[1] as keyof typeof workspaceResources];
                        if (!resource || (match[2] && !Object.hasOwn(resource, match[2]))) missing.push(`${file}: ${match[1]}.${match[2]}`);
                    }
                }
            }
        }
        walk('src');
        expect(missing).toEqual([]);
    });
    it('keeps demo credentials and environment secrets out of public resources', () => {
        expect(JSON.stringify(workspaceResources)).not.toMatch(/passwordHash|passwordSalt|BETTER_AUTH_SECRET|DATABASE_URL/);
    });
});
