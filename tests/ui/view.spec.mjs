import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('dismiss, reload, restore and complete tasks through the actual plugin view', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Your tasks' })).toBeVisible();
  await expect(page.locator('.obsicheck-task')).toHaveCount(6);
  await page.getByRole('button', { name: 'Dismiss: Review the new homepage copy', exact: true }).click();
  await expect(page.locator('.obsicheck-task')).toHaveCount(5);
  expect(await page.evaluate(() => window.sources['Projects/Website launch.md'])).toContain('- [ ] Review the new homepage copy <!-- obsicheck:dismissed -->');
  await page.reload();
  await expect(page.locator('.obsicheck-task')).toHaveCount(5);
  await page.getByRole('button', { name: /^Dismissed/ }).click();
  await expect(page.locator('.obsicheck-task')).toHaveCount(2);
  await page.getByRole('button', { name: 'Restore: Review the new homepage copy', exact: true }).click();
  await expect(page.locator('.obsicheck-task')).toHaveCount(1);
  await page.getByRole('button', { name: /^Open/ }).click();
  await page.getByRole('checkbox', { name: 'Complete: Review the new homepage copy', exact: true }).check();
  await page.getByRole('button', { name: /^Completed/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Reopen: Review the new homepage copy', exact: true })).toBeChecked();
  expect(await page.evaluate(() => window.notices)).toEqual([]);
});

test('search, navigation, empty states and stale-write protection', async ({ page }) => {
  await page.getByRole('searchbox').fill('homepage');
  await expect(page.locator('.obsicheck-task')).toHaveCount(1);
  await page.getByRole('button', { name: 'Review the new homepage copy', exact: true }).click();
  expect(await page.evaluate(() => window.opened[0])).toMatchObject({ path: 'Projects/Website launch.md', eState: { line: 1 } });
  await page.evaluate(() => { window.sources['Projects/Website launch.md'] = '# Changed\n' + window.sources['Projects/Website launch.md']; });
  await page.getByRole('button', { name: 'Dismiss: Review the new homepage copy', exact: true }).click();
  expect(await page.evaluate(() => window.notices[0])).toContain('This note changed');
  expect(await page.evaluate(() => window.sources['Projects/Website launch.md'])).not.toContain('homepage copy <!--');
  await page.getByRole('searchbox').fill('nonexistent');
  await expect(page.getByRole('heading', { name: 'No matching tasks' })).toBeVisible();
});

test('task text is left aligned and layouts fit desktop and narrow dark views', async ({ page }, testInfo) => {
  const text = page.locator('.obsicheck-task-text').first();
  await expect(text).toHaveCSS('text-align', 'left');
  await expect(text).toHaveCSS('display', 'block');
  await page.screenshot({ path: testInfo.outputPath('desktop-light.png'), fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.evaluate(() => document.body.classList.add('theme-dark'));
  await expect(page.getByRole('button', { name: /^Dismissed/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-dark.png'), fullPage: true });
  await page.getByRole('button', { name: /^Dismissed/ }).click();
  await page.screenshot({ path: testInfo.outputPath('dismissed-dark.png'), fullPage: true });
});
