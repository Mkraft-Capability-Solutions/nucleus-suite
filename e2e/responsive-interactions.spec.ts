import { test, expect } from '@playwright/test';

const password=process.env.DEMO_TEST_PASSWORD!;
async function login(page: import('@playwright/test').Page, role='employee'){
 await page.goto('/login');await page.getByRole('textbox',{name:'Email Address'}).fill(role+'@nucleus.com');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
}

test('public pages and login fit narrow and short screens in either inherited theme',async({page},info)=>{
 test.setTimeout(180000);
 for(const width of [320,768,1440]){
  await page.setViewportSize({width,height:568});
  for(const theme of ['light','dark']){
   for(const path of ['/','/about','/features','/why-nucleus','/docs','/contact','/login']){
    await page.goto(path);
    if(await page.locator('html').getAttribute('data-theme')!==theme){await page.getByRole('button',{name:'Choose theme'}).click();await page.getByRole('menuitemradio',{name:theme==='dark'?'Graphite night':'Pearl violet'}).click();}
    await expect(page.getByRole('main').or(page.locator('input[type=email]')).first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} ${width} ${theme}`).toBe(true);
    if(path==='/login'){await page.getByRole('button',{name:'Sign In',exact:true}).scrollIntoViewIfNeeded();await expect(page.getByRole('button',{name:'Sign In',exact:true})).toBeInViewport();}
   }
  }
 }
 await page.setViewportSize({width:320,height:568});await page.goto('/');await page.getByRole('banner').locator('summary').click();await expect(page.getByRole('link',{name:'Log in',exact:true})).toBeInViewport();
 await page.screenshot({path:info.outputPath('mobile-public-menu.png'),fullPage:true});
});

test('mobile role dashboards, theme dialogs and navigation remain usable',async({page},info)=>{
 await page.setViewportSize({width:320,height:640});
 for(const role of ['employee','hr','superadmin','manager','admin']){
  await login(page,role);
  await expect(page.locator('[data-workspace-module]')).toBeVisible();
  const themeButton=page.getByRole('button',{name:'Choose theme'});
  // The persisted theme must also drive MUI portal colors.
  if(await page.locator('html').getAttribute('data-theme')!=='dark'){await themeButton.click();await page.getByRole('menuitemradio',{name:'Graphite night'}).click();}
  if(['employee','hr','superadmin'].includes(role)){
   await page.getByRole('button',{name:'Customize',exact:true}).click();
   await page.getByRole('button',{name:'Add widgets',exact:true}).click();
   const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
   const bounds=await dialog.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(321);
   expect(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(18, 36, 49)');
   await expect(page.locator('.MuiDialog-container')).toHaveCSS('opacity','1');
   await page.screenshot({path:info.outputPath(`${role}-dark-dialog.png`),animations:'disabled'});
   await page.getByRole('button',{name:'Done',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  }
  await page.getByTitle('User profile and account links',{exact:true}).click();await expect(page.getByRole('button',{name:'Sign Out of Nucleus'})).toBeInViewport();
  await page.getByRole('button',{name:'Sign Out of Nucleus'}).click();await expect(page).toHaveURL(/\/$/);
 }
});

test('semantic text and primary controls meet contrast in both themes',async({page})=>{
 await login(page);
 for(const theme of ['light','dark']){
  if(await page.locator('html').getAttribute('data-theme')!==theme){await page.getByRole('button',{name:'Choose theme'}).click();await page.getByRole('menuitemradio',{name:theme==='dark'?'Graphite night':'Pearl violet'}).click();}
  const ratios=await page.evaluate(()=>{
   const probe=document.createElement('span');document.body.append(probe);
   const luminance=(token:string)=>{probe.style.color=`var(${token})`;const rgb=getComputedStyle(probe).color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
   const result=[['--text','--card'],['--text-2','--card'],['--text-3','--card'],['--signal','--card'],['--on-signal','--signal']].map(([text,bg])=>{const a=luminance(text),b=luminance(bg);return {text,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};});probe.remove();return result;
  });
  for(const result of ratios)expect(result.ratio,`${theme}: ${result.text} on ${result.bg}`).toBeGreaterThanOrEqual(4.5);
 }
});

test('mobile module labels and keyboard scrolling expose complete data',async({page},info)=>{
 await page.setViewportSize({width:320,height:640});await login(page,'superadmin');
 await page.getByRole('button',{name:'Open Dual-Pane Navigator'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 const names=dialog.locator('[class*="moduleName"]');expect(await names.count()).toBeGreaterThan(1);
 for(const name of await names.all())await expect(name).toBeVisible();
 expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('mobile-module-menu.png'),animations:'disabled'});
 await page.keyboard.press('Escape');
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:'people_core'})));
 const region=page.getByRole('region',{name:'Data table — scroll horizontally for more columns'}).first();await expect(region).toBeVisible();
 await region.focus();await page.keyboard.press('ArrowRight');
 await expect.poll(()=>region.evaluate(el=>el.scrollLeft)).toBeGreaterThan(0);
});
