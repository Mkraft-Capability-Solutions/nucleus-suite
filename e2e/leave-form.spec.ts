import {test,expect} from '@playwright/test';
test('SCR-030 derives days, preserves half-day overrides and rejects invalid workflows',async({page},info)=>{
 await page.goto('/login');await page.getByLabel('Email Address').fill('superadmin@nucleus.com');await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect(page).toHaveURL(/\/workspace$/);
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('nucleus:navigate_tab',{detail:'leave_requests'})));
 await page.getByRole('button',{name:'Apply for leave',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 const days=dialog.getByRole('spinbutton',{name:'Number of Days'}),from=dialog.getByLabel('From date'),to=dialog.getByLabel('To date');
 await expect(from).toHaveValue('2026-09-13');await expect(to).toHaveValue('2026-09-13');await expect(days).toHaveValue('1');
 await dialog.getByRole('button',{name:'Increase number of days by half a day'}).click();await expect(days).toHaveValue('1.5');
 await dialog.getByRole('button',{name:'Decrease number of days by half a day'}).click();await expect(days).toHaveValue('1');
 await dialog.getByRole('button',{name:'Create record',exact:true}).click();await expect(dialog).toBeVisible();
 await dialog.getByLabel('Employee').selectOption({index:1});await dialog.getByLabel('Leave type').selectOption({index:1});
 await to.fill('2026-09-14');await expect(days).toHaveValue('2');await days.fill('1.5');await dialog.getByLabel('Reason').fill('');await expect(days).toHaveValue('1.5');
 await days.fill('2.25');await dialog.locator('form').evaluate(form=>form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));await expect(dialog).toBeVisible();expect(await days.evaluate(input=>(input as HTMLInputElement).validity.stepMismatch)).toBe(true);
 await days.fill('2.5');await to.fill('2026-09-15');await expect(days).toHaveValue('3');await from.fill('');await expect(days).toHaveValue('');
 await from.fill('2026-09-16');await dialog.getByRole('button',{name:'Create record',exact:true}).click();await expect(dialog).toBeVisible();
 await from.fill('2026-09-13');await days.fill('2.5');
 await page.screenshot({path:info.outputPath('leave-form.png'),animations:'disabled'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await dialog.getByRole('button',{name:'Create record',exact:true}).click();await expect(dialog).toBeHidden();
 await page.getByRole('button',{name:'Apply for leave',exact:true}).click();await expect(page.getByRole('spinbutton',{name:'Number of Days'})).toHaveValue('1');
});

test('global preflight rejects whitespace and accepts corrected programmatic values', async ({page}) => {
 await page.goto('/login');
 await expect(page.getByLabel('Email Address')).toBeVisible();
 const result = await page.evaluate(() => {
  const form = document.createElement('form');
  const input = document.createElement('input');
  input.required = true; input.value = '   '; form.append(input); document.body.append(form);
  let executions = 0;
  form.addEventListener('submit', event => {event.preventDefault(); executions++;});
  form.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
  const blocked = executions === 0;
  input.value = 'Corrected without input event';
  form.dispatchEvent(new Event('submit', {bubbles:true,cancelable:true}));
  form.remove();
  return {blocked,executions};
 });
 expect(result).toEqual({blocked:true,executions:1});
});

test('shared action dialog resets safely between requests', async ({page}) => {
 await page.goto('/login');
 await page.getByLabel('Email Address').fill('superadmin@nucleus.com');
 await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_TEST_PASSWORD!);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page).toHaveURL(/\/workspace$/);
 await page.evaluate(() => window.dispatchEvent(new CustomEvent('nucleus:open-action',{detail:{action:'employee',context:{firstName:'Initial'}}})));
 const dialog=page.getByRole('dialog',{name:'Add employee'});
 await expect(dialog.getByLabel('First name')).toHaveValue('Initial');
 await dialog.getByLabel('First name').fill('Changed');
 await dialog.getByRole('button',{name:'Create employee',exact:true}).click();
 await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(() => window.dispatchEvent(new CustomEvent('nucleus:open-action',{detail:{action:'employee',context:{firstName:'Next request'}}})));
 await expect(page.getByRole('dialog',{name:'Add employee'}).getByLabel('First name')).toHaveValue('Next request');
});
