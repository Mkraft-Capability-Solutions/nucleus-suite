import {test, expect} from '@playwright/test';
test('login shares public navigation, logo and appearance', async ({page}, info) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    const publicLinks = await header.locator('a').evaluateAll(links => links.map(link => ({text: link.textContent, href: link.getAttribute('href')})));
    const publicLogo = await header.locator('img').getAttribute('src');
    await page.goto('/login');
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(header).toBeVisible();
    expect(await header.locator('a').evaluateAll(links => links.map(link => ({text: link.textContent, href: link.getAttribute('href')})))).toEqual(publicLinks);
    expect(await header.locator('img').getAttribute('src')).toBe(publicLogo);
    if (info.project.name === 'mobile') {
        await header.locator('summary').click();
        await expect(header.getByRole('link', {name: 'About', exact: true})).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({path:info.outputPath('login-header.png')});
});
