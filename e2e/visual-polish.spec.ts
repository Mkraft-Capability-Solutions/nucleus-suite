import {test,expect} from '@playwright/test';
test('home walkthrough and access control remain legible across palettes',async({page},info)=>{
 test.setTimeout(150000);
 await page.goto('/');
 await expect(page.getByRole('heading',{name:'HR that flows. People who thrive.'})).toBeVisible();
 await page.getByRole('tab',{name:'HR Manager',exact:true}).click();
 await expect(page.getByRole('heading',{name:'See what needs your attention.'})).toBeVisible();
 await page.getByRole('tab',{name:'HR Manager',exact:true}).press('ArrowRight');
 await expect(page.getByRole('tab',{name:'Superadmin',exact:true})).toBeFocused();
 await page.screenshot({path:info.outputPath('home.png'),fullPage:true});
 await page.goto('/login');await page.getByLabel('Email Address').fill('superadmin@nucleus.com');await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:'access_control'})));
 await expect(page.getByRole('heading',{name:'Access Control Studio'})).toBeVisible();
 for(const name of ['Pearl violet','Graphite night','Slate blue','Sage teal']){
  await page.getByRole('button',{name:'Choose theme'}).click();await page.getByRole('menuitemradio',{name}).click();
  await expect(page.getByRole('menuitemradio',{name})).toBeHidden();
  const contrast=await page.locator('[class*="metricCard"]').first().evaluate(card=>{
   const label=card.querySelector('[class*="metricLabel"]')!;
   const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
   const lum=(value:number[])=>value.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
   const a=lum(rgb(getComputedStyle(label).color)),b=lum(rgb(getComputedStyle(card).backgroundColor));
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  expect(contrast,name).toBeGreaterThanOrEqual(4.5);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.screenshot({path:info.outputPath(`access-${name}.png`),fullPage:true});
 }
 await page.locator('[class*="userHeroCard"]').scrollIntoViewIfNeeded();
 await page.screenshot({path:info.outputPath('access-details.png')});
 await expect(page.getByText('98.4%',{exact:true})).toHaveCount(0);
});
