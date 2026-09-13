import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
test('light workspace has no fixed dark content panels across module entries',async({page,request})=>{
 test.setTimeout(180000);
 await page.emulateMedia({reducedMotion:'reduce'});
 const payload=await(await request.get('/api/workspace-data')).json();
 const targets=[...new Set(['people_core','attendance','leaves','payroll','recruitment','onboarding','performance','learning','compensation','experience','integrations','compliance','helpdesk','contract_workforce','projects','team','settings','analytics','access_control',...payload.resources['lib.operational-module-registry'].modules.map((x:{id:string})=>x.id),...Array.from({length:10},(_,i)=>`S${i+1}`)])] as string[];
 await page.goto('/login');await page.getByLabel('Email Address').fill('superadmin@nucleus.com');await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
 await page.getByRole('button',{name:'Choose theme'}).click();await page.getByRole('menuitemradio',{name:'Pearl violet'}).click();
 const findings=[];
 for(const id of targets){
  if(/^S\d+$/.test(id)){await page.getByRole('button',{name:'Switch Dashboard Console',exact:true}).click();await page.getByRole('menu').getByRole('button',{name:new RegExp(`^${id}\\b`)}).click();await expect(page.locator('[data-workspace-console]')).toHaveAttribute('data-workspace-console',id);}
  else{await page.evaluate(id=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:id})),id);await expect(page.locator('[data-workspace-module]')).toHaveAttribute('data-workspace-module',id);}
  const dark=await page.locator('[data-workspace-module]').evaluate(root=>Array.from(root.querySelectorAll('*')).flatMap(el=>{
   const rect=el.getBoundingClientRect(),s=getComputedStyle(el);if(rect.width<200||rect.height<80||s.visibility==='hidden'||s.display==='none')return [];
   const colors=[s.backgroundColor,...s.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map(value=>typeof value==='string'?value:value[0]);
   return colors.flatMap(value=>{const rgb=value.match(/[\d.]+/g)?.map(Number);if(!rgb||rgb.length<3||(rgb[3]??1)<.8)return [];return rgb.slice(0,3).reduce((a,b)=>a+b)/3<75?[{tag:el.tagName,class:el.getAttribute('class'),background:value,text:el.textContent?.slice(0,80)}]:[];});
  }));
  if(dark.length)findings.push({id,dark});
 }
 writeFileSync('/tmp/nucleus-dark-surface-audit.json',JSON.stringify(findings,null,2));
 console.log(`Checked ${targets.length} module/console entries for large fixed dark panels in light mode.`);
 expect(findings).toEqual([]);
});
