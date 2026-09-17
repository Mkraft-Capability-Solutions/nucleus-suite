import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)), 'server-only': fileURLToPath(new URL('./scripts/server-only-stub.ts', import.meta.url)) } },
    test: {
        include: ['src/**/*.test.ts'],
        setupFiles: ['./scripts/test-data-setup.mjs'],
        testTimeout: 15000,
        coverage: {
            provider: 'v8',
            include: ['src/lib/hr-rules.ts', 'src/server/vp/policy.ts'],
            thresholds: { lines: 90, functions: 90, statements: 90, branches: 85 },
        },
    },
});
