import { expect, test } from '@playwright/test';

test('Feature Catalog opens, filters and navigates without breaking the workspace', async ({ page }) => {
 await page.setViewportSize({ width: 1440, height: 900 });
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('/login');
 await page.getByRole('textbox', { name: 'Email Address' }).fill('superadmin@nucleus.com');
 await page.getByLabel('Password', { exact: true }).fill(process.env.DEMO_TEST_PASSWORD!);
 await page.getByRole('button', { name: 'Sign In', exact: true }).click();
 await expect(page).toHaveURL(/\/workspace$/);
 await page.getByRole('button', { name: 'Feature Catalog', exact: true }).click();
 await expect(page.getByRole('button', { name: 'ALL', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Core HR', exact: true }).last().click();
 await page.getByRole('button').filter({ has: page.getByRole('heading', { name: 'People Core', exact: true }) }).click();
 await expect(page.locator('[data-workspace-module]')).toHaveAttribute('data-workspace-module', 'people_core');
 await expect(page).toHaveURL(/\/workspace$/);
 expect(errors).toEqual([]);
});
