import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });

export default defineConfig({
    testDir: './e2e',
    timeout: 90_000,
    expect: { timeout: 30_000 },
    workers: 1,
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:3100',
        trace: 'retain-on-failure',
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: process.env.E2E_BASE_URL ? undefined : {
        command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
        url: 'http://127.0.0.1:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { APP_DATA_MODE: 'database', DEMO_AUTH_ENABLED: 'true', BETTER_AUTH_URL: 'http://127.0.0.1:3100' },
    },
});
