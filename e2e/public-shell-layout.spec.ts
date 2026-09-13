import {test,expect} from '@playwright/test';
test('public navigation tracks the URL and login has a bounded responsive layout',async({page},info)=>{
 for(const route of ['/', '/about', '/features', '/why-nucleus', '/docs', '/contact', '/login']){
  await page.goto(route);
  const active=page.getByRole('banner').locator(`a[aria-current="page"][href="${route}"]`);
  await expect(active.first()).toHaveCount(1);
  const background=await active.first().evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  const contrast=await active.first().evaluate(el=>{
   const luminance=(color:string)=>color.match(/[\d.]+/g)!.slice(0,3).map(Number).map(value=>{const n=value/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
   const style=getComputedStyle(el),a=luminance(style.color),b=luminance(style.backgroundColor);
   return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
 }
 await expect(page.getByRole('heading',{name:'Welcome Back'})).toBeVisible();
 const form=page.locator('section[aria-labelledby="login-form-title"]');
 const box=await form.boundingBox();expect(box!.width).toBeLessThanOrEqual(441);
 if(info.project.name==='mobile')await expect(page.locator('#login-introduction-title')).toBeHidden();
 else {
  await expect(page.locator('#login-introduction-title')).toBeVisible();
  const intro=await page.locator('#login-introduction-title').boundingBox();expect(intro!.x+intro!.width).toBeLessThan(box!.x);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.screenshot({path:info.outputPath('login-layout.png'),fullPage:true});
});
