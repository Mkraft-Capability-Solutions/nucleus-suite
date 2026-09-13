import { test, expect } from '@playwright/test';

test('public pages reflow across themes and respect reduced motion', async ({page}, info) => {
    test.setTimeout(180000);
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const route of ['/', '/about', '/features', '/why-nucleus', '/docs', '/contact', '/login']) {
        await page.goto(route);
        await expect(route === '/login' ? page.getByRole('heading',{name:'Welcome Back'}) : page.locator('h1')).toBeVisible();
        for (const theme of ['Pearl violet','Graphite night','Slate blue','Sage teal']) {
            await page.getByRole('button',{name:'Choose theme'}).click();
            await page.getByRole('menuitemradio',{name:theme}).click();
            await expect(page.getByRole('menuitemradio',{name:theme})).toBeHidden();
            expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${route} ${theme}`).toBe(true);
            await expect(page.locator('main')).toBeVisible();
        }
    }
    await page.goto('/');
    await page.getByRole('tab',{name:'HR Manager',exact:true}).click();
    await expect(page.getByRole('heading',{name:'See what needs your attention.'})).toBeVisible();
    const animations = await page.locator('main').evaluate(root=>root.getAnimations({subtree:true}).filter(a=>a.playState==='running').length);
    expect(animations).toBe(0);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'People first. Everything connected.'})).toBeVisible();
    await page.getByRole('tab',{name:'Employee',exact:true}).press('ArrowRight');
    await expect(page.getByRole('tab',{name:'HR Manager',exact:true})).toBeFocused();
    await page.screenshot({path:info.outputPath('landing.png'),fullPage:true,animations:'disabled'});
    if (info.project.name==='mobile') {
        const menu=page.locator('header details');
        await menu.locator('summary').click();
        await menu.getByRole('link',{name:'Features',exact:true}).focus();
        await page.keyboard.press('Escape');
        await expect(menu).not.toHaveAttribute('open','');
        await expect(menu.locator('summary')).toBeFocused();
    }
});
