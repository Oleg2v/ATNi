import { expect, test } from '@playwright/test';

test.describe('P2 features', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, 'desktop project only');

  test('Lite mode replaces charts with tables and shows the measured page weight', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Load sample answers' }).click();
    await expect(page.locator('svg.bar-chart')).toHaveCount(1);
    await page.getByRole('button', { name: /Lite mode: off/ }).click();
    await expect(page.locator('svg.bar-chart')).toHaveCount(0);
    await expect(page.getByRole('table').filter({ hasText: 'Marketing' }).first()).toBeVisible();
    await expect(page.getByText(/Measured in this browser: \d+ KB transferred/)).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/lite/);
    await page.getByRole('button', { name: /Lite mode: on/ }).click();
    await expect(page.locator('svg.bar-chart')).toHaveCount(1);
  });

  test('account: download my data and delete my account (simulated)', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Load sample answers' }).click();
    await page.goto('/#/account');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download my data/ }).click();
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/\.json$/);
    await page.getByRole('button', { name: /Delete my account/ }).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: /Delete/ }).click();
    await expect(page.locator('#main').getByText(/Account deleted \(simulated\)/)).toBeVisible();
    await page.goto('/#/results');
    await expect(page.getByText('No completed assessment yet.')).toBeVisible();
  });

  test('translations: coverage per section and CSV export', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/#/');
    await page.getByLabel(/Demo role switcher/).selectOption('content');
    await page.goto('/#/admin/translations');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Translation/i);
    await expect(page.getByRole('row').filter({ hasText: 'recommendations' })).toContainText(/12\s*24\s*50 %/);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export strings for translator/ }).click();
    const file = await dl;
    expect(file.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('rollback from the journal restores the previous published version', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/#/');
    await page.getByLabel(/Demo role switcher/).selectOption('methodology');
    await page.goto('/#/admin/methodology/v1.1');
    await page.getByRole('button', { name: 'Publish v1.1' }).click();
    const dlg = page.getByRole('dialog', { name: 'Publish v1.1' });
    await dlg.getByLabel(/Publication comment/).fill('Wording update.');
    const ack = dlg.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await dlg.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.locator('.toast')).toContainText('v1.1 published');
    await page.goto('/#/admin/audit');
    await page.getByRole('button', { name: /Roll back to v1\.0/ }).click();
    await page.getByRole('dialog', { name: /Roll back/ }).getByRole('button', { name: 'Roll back', exact: true }).click();
    await page.goto('/#/admin/methodology');
    await expect(page.getByRole('row').filter({ hasText: /^v1\.0/ })).toContainText('published');
    await expect(page.getByRole('row').filter({ hasText: /^v1\.1/ })).toContainText('archived');
  });
});
