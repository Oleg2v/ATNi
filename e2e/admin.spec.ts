import { expect, test, type Page } from '@playwright/test';

async function asRole(page: Page, role: string) {
  await page.goto('/#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Load sample answers' }).click();
  await page.getByLabel(/Demo role switcher/).selectOption(role);
}

test.describe('methodology administration', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, 'desktop project only');

  test('score edit 5 → 2.5 blocks publication until a recommendation exists; publish v1.1; past result stays on v1.0', async ({ page }) => {
    await asRole(page, 'methodology');
    await page.goto('/#/admin/methodology/v1.1');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('v1.1');
    const publish = page.getByRole('button', { name: 'Publish v1.1' });
    await expect(publish).toBeEnabled();
    // open question 2.1 and change the score of "Yes" from 5 to 2.5
    await page.getByRole('navigation', { name: 'Questions' }).getByRole('button', { name: /^2\.1/ }).click();
    const score = page.locator('#q-2\\.1-prop-0-score');
    await expect(score).toHaveValue('5');
    await score.fill('2.5');
    await score.blur();
    await expect(publish).toBeDisabled();
    const reason = page.locator('#publish-reason');
    await expect(reason).toContainText('No recommendation for score 2.5 in question 2.1');
    // the blocking message links to the field
    await reason.getByRole('link', { name: 'No recommendation for score 2.5 in question 2.1' }).click();
    await expect(page.locator('#field-2\\.1-recommandations')).toBeVisible();
    // add the recommendation (prefilled with the missing score)
    await page.getByRole('button', { name: /Add recommendation \(score 2\.5\)/ }).click();
    await page.getByLabel('Text shown at score 2.5').fill('Review the policy with senior management and commit to a published version within a year.');
    await page.getByLabel('Text shown at score 2.5').blur();
    // the old entry for score 5 is now unreachable → warning, remove it
    await page.getByRole('button', { name: 'Remove recommendation for score 5' }).click();
    await expect(publish).toBeEnabled();
    // health panel warns about missing Swahili text
    await expect(page.locator('[data-tour="health"]')).toContainText('has no Swahili text');

    // impact preview before publishing
    await page.getByRole('button', { name: 'Preview impact on past assessments' }).click();
    await expect(page.getByText(/Of \d+ past assessments, \d+ would have a different letter/)).toBeVisible();
    await expect(page.getByText(/stay on v1\.0 until the company assesses again/)).toBeVisible();

    // publish with a comment
    await publish.click();
    const dlg = page.getByRole('dialog', { name: 'Publish v1.1' });
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText(/\d+ would have a different letter/);
    await dlg.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(dlg.getByText('Publication comment is required')).toBeVisible();
    await dlg.getByLabel(/Publication comment/).fill('Lower weight for an unapproved policy; added recommendation for score 2.5.');
    const ack = dlg.getByRole('checkbox');
    if (await ack.count()) await ack.first().check();
    await dlg.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.locator('.toast')).toContainText('v1.1 published');
    await expect(page.getByText('Published versions are immutable', { exact: false }).first()).toBeVisible();

    // journal has the publish entry with the comment
    await page.goto('/#/admin/audit');
    await expect(page.getByRole('row').filter({ hasText: 'publish' }).filter({ hasText: 'v1.1' })).toContainText('Lower weight for an unapproved policy');

    // versions list: v1.1 published, v1.0 archived
    await page.goto('/#/admin/methodology');
    await expect(page.getByRole('row').filter({ hasText: /^v1\.1/ })).toContainText('published');
    await expect(page.getByRole('row').filter({ hasText: /^v1\.0/ })).toContainText('archived');

    // the company's past result still shows v1.0 and the same letter
    await page.getByLabel(/Demo role switcher/).selectOption('company');
    await page.goto('/#/results');
    await expect(page.getByText('Methodology version v1.0')).toBeVisible();
    await expect(page.locator('[data-tour="grade"] .grade-lg')).toHaveText('C');
    await expect(page.locator('[data-tour="history"]')).toContainText('archived');
    // a new assessment starts on v1.1
    await page.goto('/#/');
    await expect(page.getByText('Version: v1.1')).toBeVisible();
  });

  test('roles: content editor sees No access to company answers; health page and importer report', async ({ page }) => {
    await asRole(page, 'content');
    await page.goto('/#/results');
    await expect(page.getByRole('status')).toContainText('No access');
    await expect(page.getByRole('status')).toContainText('do not see individual company answers');
    await page.goto('/#/admin/health');
    await expect(page.getByRole('status')).toContainText('No access');
    await page.getByLabel(/Demo role switcher/).selectOption('methodology');
    await page.goto('/#/admin/health');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/health/i);
    await expect(page.getByText('Every achievable score has a recommendation').first()).toBeVisible();
    await expect(page.getByText('No dangling dependencies or cycles').first()).toBeVisible();
    await expect(page.getByText(/Maximum score computed: 65 points/).first()).toBeVisible();
    // importer: sample file report
    await page.goto('/#/admin/import');
    await page.getByRole('button', { name: 'Use the sample file' }).click();
    await expect(page.getByText(/14 questions/).first()).toBeVisible();
    await expect(page.getByText(/2\.4/).first()).toBeVisible(); // missing recommendation for 2.5 in 2.4
    await expect(page.getByText(/chain/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Create draft version from this import' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('import');
  });

  test('assistant hand-off appears in the admin queue and can be published as FAQ', async ({ page }) => {
    await asRole(page, 'company');
    await page.locator('[data-tour="assistant"]').click();
    const dlg = page.getByRole('dialog', { name: /Assistant/ });
    await dlg.getByLabel(/Ask about your results/).fill('What customs duty applies to imported packaging machines?');
    await dlg.getByRole('button', { name: 'Send' }).click();
    await dlg.getByRole('button', { name: /Send to the hub team/ }).click();
    await expect(dlg).toContainText('ticket HQ-0002');
    await page.keyboard.press('Escape');
    await page.getByLabel(/Demo role switcher/).selectOption('content');
    await page.goto('/#/admin/tickets');
    const row = page.locator('article, tr, li').filter({ hasText: 'HQ-0002' }).first();
    await expect(row).toContainText('customs duty');
    await row.getByRole('textbox').fill('Customs duty is outside the scope of the hub; the national revenue authority publishes the tariff schedule.');
    await row.getByRole('button', { name: /Save answer/ }).click();
    await row.getByRole('button', { name: /Publish as FAQ/ }).click();
    await expect(row).toContainText(/published|kb-36/);
    // the new FAQ is now retrievable by the assistant
    await page.getByLabel(/Demo role switcher/).selectOption('company');
    await page.goto('/#/results');
    await page.locator('[data-tour="assistant"]').click();
    const dlg2 = page.getByRole('dialog', { name: /Assistant/ });
    await dlg2.getByLabel(/Ask about your results/).fill('What customs duty applies to imported packaging machines?');
    await dlg2.getByRole('button', { name: 'Send' }).click();
    await expect(dlg2.locator('.msg-bot').last()).toContainText('revenue authority');
    await expect(dlg2.locator('.msg-bot').last()).toContainText('kb-36');
  });

  test('add-country wizard copies the methodology as a draft with thresholds to be provided', async ({ page }) => {
    await asRole(page, 'admin');
    await page.goto('/#/admin/countries');
    await page.getByRole('button', { name: 'Add a country' }).click();
    await page.getByLabel('Planned country').selectOption('NG');
    await page.getByRole('button', { name: 'Next' }).click(); // languages
    await page.getByRole('button', { name: 'Next' }).click(); // methodology
    await page.getByLabel('Copy methodology from a published version').selectOption('v1.0');
    await page.getByRole('button', { name: 'Next' }).click(); // review
    await expect(page.getByText(/to be provided/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click(); // activate
    await page.getByRole('button', { name: /Publish now/ }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Nigeria' })).toContainText('active');
    await expect(page.getByRole('row').filter({ hasText: 'Nigeria' })).toContainText('v1.0-NG');
  });
});
