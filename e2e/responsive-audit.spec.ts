import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
test('responsive audit of all workspace modules', async ({page,request}, info) => {
 test.setTimeout(240000);
 const payload=await (await request.get('/api/workspace-data')).json();
 const modules=[...new Set(['dashboard','people_core','attendance','leaves','payroll','recruitment','onboarding','performance','learning','compensation','experience','integrations','compliance','helpdesk','contract_workforce','projects','team','settings','analytics','access_control',...payload.resources['lib.operational-module-registry'].modules.map((x:{id:string})=>x.id)])] as string[];
 await page.goto('/login');await page.locator('input[type=email]').fill('superadmin@nucleus.com');await page.locator('input[type=password]').fill(process.env.DEMO_TEST_PASSWORD!);await page.locator('button[type=submit]').click();await expect(page.locator('[data-workspace-module]')).toBeVisible();
 const results=[];
 const targets=process.env.RESPONSIVE_TARGETS?.split(',') || [...modules,...Array.from({length:10},(_,i)=>`S${i+1}`)];
 for(const width of [320,390,768,1440]){
 await page.setViewportSize({width,height:900});
 for(const theme of ['light','dark']){
 await page.evaluate(t=>document.documentElement.setAttribute('data-theme',t),theme);
 for(const id of targets){
 if(/^S\d+$/.test(id)){
  await page.getByRole('button',{name:'Switch Dashboard Console',exact:true}).click();
  await page.getByRole('menu').getByRole('button',{name:new RegExp(`^${id}\\b`)}).click();
  await expect(page.locator('[data-workspace-console]')).toHaveAttribute('data-workspace-console',id);
 } else {
 await page.evaluate(id=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:id})),id);
 await expect(page.locator('[data-workspace-module]')).toHaveAttribute('data-workspace-module',id);
 }
 const overflow=await page.locator('[data-workspace-module]').evaluate(root=>[root,...root.querySelectorAll('*')].filter(el=>{
 const e=el as HTMLElement,s=getComputedStyle(e);if(!e.clientWidth||e.scrollWidth<=e.clientWidth+3||['auto','scroll'].includes(s.overflowX)||['TABLE','TBODY','TR','THEAD','SVG'].includes(e.tagName))return false;
 // Intentional text ellipsis is allowed; overflowing layout containers are not.
 return s.textOverflow!=='ellipsis' && e.children.length>0;
 }).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,width:e.clientWidth,scroll:e.scrollWidth,text:e.textContent?.slice(0,70)})));
 if(overflow.length)results.push({width,theme,id,overflow});
 }
 }
 }
 writeFileSync('/tmp/nucleus-responsive-audit.json',JSON.stringify(results,null,2));
 console.log(`Audited ${targets.length} module/console views at four sizes in two themes; ${results.length} views with overflowing containers.`);
 await page.screenshot({path:info.outputPath('audit.png')});
 expect(results, 'Unexpected layout overflow (see /tmp/nucleus-responsive-audit.json)').toEqual([]);
});
