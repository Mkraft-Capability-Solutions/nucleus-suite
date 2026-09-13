import { test, expect } from '@playwright/test';

test('semantic status badges stay readable in each palette', async ({page}) => {
    test.setTimeout(180000);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('/login');
    await page.getByLabel('Email Address').fill('superadmin@nucleus.com');
    await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);
    await page.getByRole('button',{name:'Sign In',exact:true}).click();
    await expect(page).toHaveURL(/\/workspace$/);
    let checked = 0;
    for (const theme of ['Pearl violet','Graphite night','Slate blue','Sage teal']) {
        await page.getByRole('button',{name:'Choose theme'}).click();
        await page.getByRole('menuitemradio',{name:theme}).click();
        await expect(page.getByRole('menuitemradio',{name:theme})).toBeHidden();
        for (const id of ['attendance','leaves','payroll','recruitment','onboarding','compliance']) {
            await page.evaluate(id=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:id})),id);
            const root=page.locator('[data-workspace-module]');
            await expect(root).toHaveAttribute('data-workspace-module',id);
            checked += await root.locator('[class]').evaluateAll(els => els.filter(el => /(?:badge|pill)(?:Teal|Green|Success|Amber|Warning|Coral|Red|Danger|Blue|Sky|Purple|Violet|Present|Off|Leave|EL)/i.test(el.getAttribute('class') || '')).length);
            await expect.poll(()=>root.evaluate(root=>{
                const luminance=(rgb:number[])=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
                return Array.from(root.querySelectorAll<HTMLElement>('[class]')).filter(el=>/\b(?:badge|pill)(?:Teal|Green|Success|Amber|Warning|Coral|Red|Danger|Blue|Sky|Purple|Violet|Present|Off|Leave|EL)\b/i.test((el.getAttribute('class') || '').replace(/_/g,' '))&&el.textContent?.trim()&&el.getClientRects().length).flatMap(el=>{
                    const layers:number[][]=[];
                    for(let node:Element|null=el;node;node=node.parentElement){const rgb=getComputedStyle(node).backgroundColor.match(/[\d.]+/g)!.map(Number);layers.push([rgb[0],rgb[1],rgb[2],rgb[3]??1]);}
                    const bg=layers.reverse().reduce((b,l)=>b.map((v,i)=>l[i]*l[3]+v*(1-l[3])),[255,255,255]);
                    const fg=getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0,3).map(Number);
                    const a=luminance(bg),b=luminance(fg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
                    return ratio<4.5?[{text:el.textContent,ratio}]:[];
                });
            }),{message:`${id} ${theme}`}).toEqual([]);
        }
    }
    expect(checked, 'The contrast audit must exercise rendered status badges').toBeGreaterThan(0);
});
