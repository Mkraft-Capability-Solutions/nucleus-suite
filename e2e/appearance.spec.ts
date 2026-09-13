import { expect, test } from '@playwright/test';
import catalog from '../src/data/appearance.json';

async function selectTheme(page: import('@playwright/test').Page, name: string) {
 await page.getByRole('button',{name:'Choose theme'}).click();
 await page.getByRole('menuitemradio',{name,exact:true}).click();
}
for (const theme of catalog.themes) {
 test(`${theme.name} persists from public header through login, workspace and logout`,async({page},info)=>{
  await page.goto('/');await selectTheme(page,theme.name);
  for(const path of ['/about','/features','/why-nucleus','/docs','/contact','/']){
   await page.goto(path);
   await expect(page.locator('html')).toHaveAttribute('data-appearance',theme.id);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const tokens=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {text:s.getPropertyValue('--text').trim(),bg:s.getPropertyValue('--bg').trim()};});
   expect(tokens).toEqual({text:theme.tokens['--text'],bg:theme.tokens['--bg']});
  }
  await page.screenshot({path:info.outputPath(`${theme.id}-public.png`),animations:'disabled'});
  if(info.project.name==='mobile')await page.getByRole('banner').locator('summary').click();
  await page.getByRole('link',{name:'Log in',exact:true}).filter({visible:true}).click();
  await expect(page).toHaveURL(/\/login$/);await expect(page.locator('html')).toHaveAttribute('data-appearance',theme.id);
  await page.screenshot({path:info.outputPath(`${theme.id}-login.png`),animations:'disabled'});
  await page.getByRole('textbox',{name:'Email Address'}).fill('employee@nucleus.com');
  await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);
  await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(/\/workspace$/);await expect(page.locator('html')).toHaveAttribute('data-appearance',theme.id);
  await page.screenshot({path:info.outputPath(`${theme.id}-workspace.png`),animations:'disabled'});
  await page.getByTitle('User profile and account links',{exact:true}).click();await page.getByRole('button',{name:'Sign Out of Nucleus'}).click();
  await expect(page).toHaveURL(/\/$/);await expect(page.locator('html')).toHaveAttribute('data-appearance',theme.id);
  await page.reload();await expect(page.locator('html')).toHaveAttribute('data-appearance',theme.id);
 });
}

test('theme picker works with blocked storage and synchronizes tabs',async({page,context})=>{
 await page.goto('/');const other=await context.newPage();await other.goto('/about');
 await selectTheme(page,'Sage teal');await expect(other.locator('html')).toHaveAttribute('data-appearance','teal');await other.close();
 await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');};});
 await selectTheme(page,'Graphite night');await expect(page.locator('html')).toHaveAttribute('data-appearance','dark');
 await page.getByRole('link',{name:'Explore the workspace',exact:true}).first().click();
 await expect(page).toHaveURL(/\/login$/);
 await expect(page.locator('html')).toHaveAttribute('data-appearance','dark');
});

test('theme menu supports keyboard selection without hydration errors', async ({ page }) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 page.on('console', message => { if (message.type() === 'error' && /hydration|did not match/i.test(message.text())) errors.push(message.text()); });
 await page.goto('/');
 const trigger = page.getByRole('button', { name: 'Choose theme' });
 await trigger.focus(); await page.keyboard.press('Enter');
 await expect(page.getByRole('menu', { name: 'Application theme' })).toBeVisible();
 await page.getByRole('menuitemradio', { name: 'Slate blue', exact: true }).focus();
 await page.keyboard.press('Enter');
 await expect(trigger).toBeFocused();
 await expect(page.locator('html')).toHaveAttribute('data-appearance', 'blue');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-appearance', 'blue');
 await trigger.click(); await page.keyboard.press('Escape');
 await expect(trigger).toBeFocused();
 expect(errors).toEqual([]);
});
