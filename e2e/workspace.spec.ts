import { expect, test } from '@playwright/test';
const demoPassword = process.env.DEMO_TEST_PASSWORD || '';
if (!demoPassword) throw new Error('Set DEMO_TEST_PASSWORD in your local environment or CI secret store.');

test('loads JSON through the service, signs in, and renders workspace modules', async ({ page, request }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let dataRequests = 0;
    page.on('request', (request) => { if (request.url().endsWith('/api/workspace-data')) dataRequests++; });
    const data = await request.get('/api/workspace-data');
    expect(data.ok()).toBeTruthy();
    const payload = await data.json();
    expect(payload.version).toBe(1);
    expect(payload.resources.workbook.sheets['12_Employees'].length).toBeGreaterThan(0);
    expect(JSON.stringify(payload)).not.toMatch(/passwordHash|passwordSalt|BETTER_AUTH_SECRET/);
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('superadmin@nucleus.com');
    await page.locator('input[type="password"]').fill(demoPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[data-workspace-module]')).toHaveAttribute('data-workspace-module', 'dashboard');
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Application error');
    // Exercise the existing navigation contract on both desktop and mobile.
    for (const moduleId of ['people_core', 'attendance', 'leaves', 'payroll', 'recruitment', 'onboarding', 'performance', 'learning', 'compensation', 'experience', 'integrations', 'compliance', 'helpdesk', 'contract_workforce', 'projects', 'team', 'settings', 'dashboard', ...payload.resources['lib.operational-module-registry'].modules.map((item: { id: string }) => item.id)]) {
        await page.evaluate((id) => window.dispatchEvent(new CustomEvent('nucleus:navigate_tab', { detail: id })), moduleId);
        await expect(page.locator('[data-workspace-module]')).toHaveAttribute('data-workspace-module', moduleId);
        await expect(page.locator('body')).not.toContainText('Application error');
        await page.waitForTimeout(150);
    }
    for (let index = 1; index <= 10; index++) {
        await page.getByRole('button', { name: 'Switch Dashboard Console', exact: true }).click();
        await page.getByRole('menu').getByRole('button', { name: new RegExp(`^S${index}\\b`) }).click();
        await expect(page.locator('[data-workspace-console]')).toHaveAttribute('data-workspace-console', `S${index}`);
        await page.waitForTimeout(150);
    }
    await expect.poll(() => page.locator('[data-admin-overview]').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBeTruthy();
    await expect(page.getByRole('status').filter({ hasText: 'Console Switched' })).toHaveCount(0);
    await page.screenshot({ path: `test-results/workspace-${test.info().project.name}.png`, fullPage: true });
    expect(dataRequests).toBe(1);
    expect(errors).toEqual([]);
});

test('shows service errors and retries without fabricated data', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/workspace-data', async (route) => {
        requests++;
        if (requests === 1) await route.fulfill({ status: 503, body: '{}' });
        else await route.continue();
    });
    await page.goto('/login');
    await expect(page.getByRole('main').getByRole('alert')).toContainText('Workspace data could not be loaded');
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('rejects invalid credentials and malformed login requests', async ({ request }) => {
    expect((await request.post('/api/auth/login', { data: { email: 'superadmin@nucleus.com', password: 'incorrect' } })).status()).toBe(401);
    expect((await request.post('/api/auth/login', { data: { email: [], password: null } })).status()).toBe(400);
});

test('toast expires even when unrelated state keeps changing', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('superadmin@nucleus.com');
    await page.locator('input[type="password"]').fill(demoPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('[data-workspace-module]')).toBeVisible();
    await page.getByRole('button', { name: 'Switch Dashboard Console', exact: true }).click();
    await page.getByRole('menu').getByRole('button', { name: /^S2\b/ }).click();
    const toast = page.getByRole('status').filter({ hasText: 'Console Switched' });
    await expect(toast).toBeVisible();
    await expect(page.getByRole('button', { name: 'Toggle navigation panel', exact: true })).toBeInViewport();
    for (let i = 0; i < 5; i++) {
        await page.getByRole('button', { name: 'Toggle navigation panel', exact: true }).click();
        await page.waitForTimeout(700);
    }
    await expect(toast).toHaveCount(0);
});

test('does not trust stored identity and labels preview capabilities', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('nucleus_user', JSON.stringify({ email: 'superadmin@nucleus.com', role: 'SUPER_ADMIN' })));
    await page.goto('/login');
    await expect(page.getByRole('textbox', { name: 'Email Address' })).toBeVisible();
    await expect(page.getByRole('note')).toContainText('Synthetic data');
    await expect(page.getByRole('button', { name: 'Face Match', exact: true })).toHaveCount(0);
    await page.getByRole('textbox', { name: 'Email Address' }).fill('superadmin@nucleus.com');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Sign-in failed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
});

test('uses supplied branding and opens an operational screen from the MUI menu', async ({ page, request }) => {
    for (const path of ['/images/logo.png', '/images/favicon_io/favicon-32x32.png', '/favicon.ico']) {
        expect((await request.get(path)).ok()).toBeTruthy();
    }
    const manifest = await (await request.get('/images/favicon_io/site.webmanifest')).json();
    expect(manifest.icons.every((icon: { src: string }) => icon.src.startsWith('/images/favicon_io/'))).toBeTruthy();
    await page.goto('/login');
    await expect(page.getByRole('img', { name: 'Nucleus — People at the core' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Email Address' }).fill('superadmin@nucleus.com');
    await page.getByLabel('Password', { exact: true }).fill(demoPassword);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.locator('[data-workspace-module]')).toBeVisible();
    await page.keyboard.press('Control+m');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input').fill('Attendance day detail');
    const item = dialog.getByRole('button').filter({ hasText: 'Attendance day detail' });
    await expect(item.locator('svg.MuiSvgIcon-root')).not.toHaveCount(0);
    await item.click();
    await expect(page.locator('[data-workspace-module]')).toHaveAttribute('data-workspace-module', 'attendance_detail');
    await page.getByText('Process guide', { exact: false }).click();
    await expect(page.getByText('Reference workflow from the Nucleus process workbook.', { exact: false })).toBeVisible();
});

for (const account of [
    { email: 'superadmin@nucleus.com', role: 'SUPER_ADMIN', name: 'Superadmin', employeeId: null, console: 'S10' },
    { email: 'admin@nucleus.com', role: 'ADMIN', name: 'Admin', employeeId: null, console: 'S10' },
    { email: 'hr@nucleus.com', role: 'HR_MANAGER', name: 'Sunita Verma', employeeId: 'MK-102', console: 'S2' },
    { email: 'manager@nucleus.com', role: 'MANAGER', name: 'Ramesh Nair', employeeId: 'MK-104', console: 'S7' },
    { email: 'employee@nucleus.com', role: 'EMPLOYEE', name: 'Vikas Yadav', employeeId: 'MK-107', console: 'S8' },
]) {
    test(`credential persona ${account.role} opens its assigned console`, async ({ page, request }) => {
        const response = await request.post('/api/auth/login', { data: { email: account.email, password: demoPassword } });
        expect(response.status()).toBe(200);
        const payload = await response.json();
        expect(payload.user).toMatchObject({ email: account.email, role: account.role, name: account.name, employeeId: account.employeeId });
        expect(JSON.stringify(payload)).not.toMatch(/passwordHash|passwordSalt/);
        await page.goto('/login');
        await page.getByRole('textbox', { name: 'Email Address' }).fill(account.email);
        await page.getByLabel('Password', { exact: true }).fill(demoPassword);
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        await expect(page.locator('[data-workspace-console]')).toHaveAttribute('data-workspace-console', account.console);
        if (account.console === 'S10') {
            await expect(page.locator('[data-admin-overview]')).toContainText(account.name);
            await expect(page.locator('[data-dashboard-hero]')).toHaveCount(0);
        }
        if (account.role === 'ADMIN') {
            await page.evaluate(() => window.dispatchEvent(new CustomEvent('nucleus:navigate_tab', { detail: 'payroll' })));
            await expect(page.getByRole('heading', { name: 'Access restricted', exact: true })).toBeVisible();
        }
    });
}

test('removed demo account cannot authenticate', async ({ request }) => {
    const response = await request.post('/api/auth/login', { data: { email: 'removed-demo@nucleus.com', password: demoPassword } });
    expect(response.status()).toBe(401);
});
