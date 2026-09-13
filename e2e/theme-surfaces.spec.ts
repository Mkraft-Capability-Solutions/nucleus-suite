import {test,expect} from '@playwright/test';

test('navigation greeting and custom dialog surfaces follow all palettes',async({page},info)=>{
 test.setTimeout(150000);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/login');await page.getByLabel('Email Address').fill('superadmin@nucleus.com');await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
 for(const theme of ['Pearl violet','Graphite night','Slate blue','Sage teal']){
  await page.getByRole('button',{name:'Choose theme'}).click();await page.getByRole('menuitemradio',{name:theme}).click();await expect(page.getByRole('menuitemradio',{name:theme})).toBeHidden();
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:'dashboard'})));
  await page.getByRole('button',{name:'Switch Dashboard Console',exact:true}).click();
  await page.getByRole('menu').getByRole('button',{name:/^S1\b/}).click();
  const hero=page.locator('[class*=heroSection]').first();await expect(hero).toBeVisible();
  const colors=await hero.evaluate(el=>{
   const css=getComputedStyle(el),root=getComputedStyle(document.documentElement);
   return {background:css.backgroundImage,text:getComputedStyle(el.querySelector('h1')!).color,expectedText:root.getPropertyValue('--hero-text').trim(),rail:root.getPropertyValue('--rail').trim(),card:root.getPropertyValue('--card').trim()};
  });
  if(theme!=='Graphite night')expect(colors.rail).toBe(colors.card);
  const rgb=colors.background.match(/rgb\((\d+), (\d+), (\d+)\)/);
  expect(rgb).not.toBeNull();
  const average=rgb!.slice(1).map(Number).reduce((a,b)=>a+b)/3;
  expect(average,theme)[theme==='Graphite night'?'toBeLessThan':'toBeGreaterThan'](128);
  await page.screenshot({path:info.outputPath(`greeting-${theme}.png`),animations:'disabled'});
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:'people_core'})));
  await page.getByTitle('Reassign who this employee reports to').first().click();
  const title=page.getByRole('heading',{name:'Reassign Reporting Manager'});await expect(title).toBeVisible();
  const modal=title.locator('../..');
  const surface=await modal.evaluate(el=>({background:getComputedStyle(el).backgroundColor,gradient:getComputedStyle(el).backgroundImage,color:getComputedStyle(el.querySelector('h3')!).color}));
  expect(surface.gradient).toBe('none');
  const channel=surface.background.match(/[\d.]+/g)!.slice(0,3).map(Number).reduce((a,b)=>a+b)/3;
  expect(channel,theme)[theme==='Graphite night'?'toBeLessThan':'toBeGreaterThan'](128);
  await page.screenshot({path:info.outputPath(`dialog-${theme}.png`),animations:'disabled'});
  await expect(page.getByRole('dialog',{name:'Reassign Reporting Manager'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(title).toBeHidden();
  await expect(page.getByTitle('Reassign who this employee reports to').first()).toBeFocused();
 }
});
