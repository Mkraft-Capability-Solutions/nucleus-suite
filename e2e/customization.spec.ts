import { expect, test, type Page } from '@playwright/test';
const password = process.env.DEMO_TEST_PASSWORD || '';
async function login(page: Page, email = 'employee@nucleus.com') {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email Address' }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.locator('[data-personal-dashboard]')).toBeVisible();
}
const ids = (page: Page) => page.locator('[data-widget-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-widget-id')));

test('public website has working routes and contact prepares a draft without sending', async ({ page }) => {
    let workspaceCalls = 0;
    page.on('request', request => { if (request.url().includes('/api/workspace-data')) workspaceCalls++; });
    for (const path of ['/', '/about', '/features', '/why-nucleus', '/docs', '/contact']) {
        await page.goto(path);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
        if (page.viewportSize()!.width < 700) await page.getByRole('banner').locator('summary').click();
        await expect(page.getByRole('link', { name: 'Log in', exact: true }).first()).toBeVisible();
        if (page.viewportSize()!.width < 700) await page.getByRole('banner').locator('summary').click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    }
    expect(workspaceCalls).toBe(0);
    await page.getByLabel('Your name', { exact: true }).fill('Preview User');
    await page.getByLabel('Work email').fill('preview@example.com');
    await page.getByLabel('Your message').fill('I would like to review the employee dashboard.');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download message draft' }).click();
    expect((await download).suggestedFilename()).toBe('nucleus-enquiry-draft.txt');
    await expect(page.getByRole('status')).toContainText('No message has been sent');
    await page.goto('/');
    await page.screenshot({ path: `test-results/public-home-${test.info().project.name}.png`, fullPage: true });
});

test('dashboard edits save per account; undo, cancellation and imports enforce permissions', async ({ page }) => {
    await login(page);
    const original = await ids(page);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('button', { name: 'Move My day later', exact: true }).click();
    expect((await ids(page))[0]).not.toBe(original[0]);
    await page.getByRole('button', { name: 'Undo layout change' }).click();
    expect(await ids(page)).toEqual(original);
    await page.getByRole('button', { name: 'Redo layout change' }).click();
    await page.getByRole('button', { name: 'Edit My day', exact: true }).click();
    await page.getByLabel('Widget title').fill('My shift priorities');
    await page.getByLabel('Widget width').click();
    await page.getByRole('option', { name: 'Full width', exact: true }).click();
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await page.getByRole('button', { name: 'Add widgets', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toContainText('Workspace governance');
    await page.getByRole('button', { name: 'Add My documents', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Layout saved' })).toContainText('Layout saved');
    const savedIds = await ids(page);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByRole('textbox', { name: 'Email Address' }).fill('employee@nucleus.com');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My shift priorities', exact: true })).toBeVisible();
    expect(await ids(page)).toEqual(savedIds);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('button', { name: 'Remove My shift priorities', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'My shift priorities', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByLabel('Import dashboard layout').setInputFiles({ name: 'forged.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, layout: { name: 'Imported', widgets: [{ id: 'governance' }, { id: 'my-day' }] } })) });
    await expect.poll(() => ids(page)).toEqual(['my-day']);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.screenshot({ path: `test-results/custom-dashboard-${test.info().project.name}.png`, fullPage: true });
    // A fresh auth boundary cannot adopt another account's locally saved layout.
    await login(page, 'hr@nucleus.com');
    await expect(page.getByRole('heading', { name: 'Today’s HR priorities', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My shift priorities', exact: true })).toHaveCount(0);
});

test('keyboard drag and named layouts work on a governance dashboard', async ({ page }) => {
    await login(page, 'superadmin@nucleus.com');
    const initial = await ids(page);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    const handle = page.getByRole('button', { name: 'Move Workspace governance', exact: true });
    await handle.focus();
    await page.keyboard.press('Space', { delay: 100 });
    await expect(handle).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press(test.info().project.name === 'mobile' ? 'ArrowDown' : 'ArrowRight', { delay: 150 });
    await page.waitForTimeout(350);
    await page.keyboard.press('Space', { delay: 100 });
    await expect(handle).not.toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => ids(page)).not.toEqual(initial);
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await expect(page.getByRole('button', { name: 'New layout', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New layout', exact: true }).click();
    await page.getByLabel('New layout name').fill('My focus view');
    await page.getByRole('button', { name: 'Create draft' }).click();
    await page.getByLabel('Apply layout preset').selectOption('focused');
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await expect(page.getByLabel('Saved layout', { exact: true })).toContainText('My focus view');
    expect((await ids(page)).length).toBe(2);
    await page.getByRole('button', { name: 'Delete layout', exact: true }).click();
    await page.getByRole('button', { name: 'Delete saved layout', exact: true }).click();
    await expect(page.getByLabel('Saved layout', { exact: true })).not.toContainText('My focus view');
});

test('unavailable storage preserves the draft and reports a save failure', async ({ page }) => {
    await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); }; });
    await login(page);
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'could not save your layout' })).toContainText('could not save your layout');
    await expect(page.getByRole('button', { name: 'Save layout', exact: true })).toBeVisible();
});

test('sign out returns to the public home and protected entry asks for login', async ({ page }) => {
    await login(page);
    await page.getByTitle('User profile and account links', { exact: true }).click();
    await page.getByRole('button', { name: 'Sign Out of Nucleus' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('HR that flows.');
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('textbox', { name: 'Email Address' })).toBeVisible();
});

test('pointer and touch handles reorder widgets without changing source content', async ({ page, context }) => {
    await login(page, 'hr@nucleus.com');
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByLabel('Apply layout preset').selectOption('focused');
    await page.getByLabel('Dashboard columns', { exact: true }).selectOption('2');
    const original = await ids(page);
    const handle = page.getByRole('button', { name: 'Move Today’s HR priorities', exact: true });
    await handle.evaluate(element => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const start = await handle.boundingBox();
    const target = await page.locator('[data-widget-id="hr-approvals"]').boundingBox();
    expect(start).not.toBeNull(); expect(target).not.toBeNull();
    const from = { x: start!.x + start!.width / 2, y: start!.y + start!.height / 2 };
    const to = { x: target!.x + target!.width / 2, y: Math.min(page.viewportSize()!.height - 30, target!.y + target!.height * .65) };
    if (test.info().project.name === 'mobile') {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
        for (let step = 1; step <= 15; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 15, y: from.y + (to.y - from.y) * step / 15, id: 1 }] });
            await page.waitForTimeout(30);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
    } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 20 });
        await page.waitForTimeout(250);
        await page.mouse.up();
    }
    await expect.poll(() => ids(page)).not.toEqual(original);
    await expect(page.getByRole('heading', { name: 'Today’s HR priorities', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Save layout', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Layout saved' })).toBeVisible();
});

test('widget editor stays readable after switching the workspace to dark mode', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Choose theme' }).click();
    await page.getByRole('menuitemradio', { name: 'Graphite night' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Customize', exact: true }).click();
    await page.getByRole('button', { name: 'Add widgets', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Widget library', exact: true })).toBeVisible();
    const contrast = await dialog.evaluate(element => {
        const text = getComputedStyle(element.querySelector('h3')!).color;
        const background = getComputedStyle(element).backgroundColor;
        const luminance = (color: string) => {
            const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
            return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
        };
        const a = luminance(text), b = luminance(background);
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({ path: `test-results/editor-dark-${test.info().project.name}.png`, fullPage: true });
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
});
