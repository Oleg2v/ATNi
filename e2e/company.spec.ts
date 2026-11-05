import { expect, test, type Page } from '@playwright/test';

async function resetDemo(page: Page) {
  await page.goto('/#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/');
}

test.describe('company flow', () => {
  test('start → survey with conditional questions and offline save → results → why → roadmap', async ({ page }) => {
    await resetDemo(page);
    await expect(page.getByRole('region', { name: 'Disclaimer' })).toContainText('Unofficial concept by Kikkey');
    await page.getByLabel('Country').selectOption('TZ');
    await page.getByRole('radio', { name: /Small/ }).check();
    await page.getByRole('button', { name: 'Begin assessment' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Self-assessment');

    // 1.2 is conditional on 1.1 (anything but No)
    await expect(page.locator('#q-1\\.2')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Yes, in draft' }).check();
    await expect(page.locator('#q-1\\.2')).toBeVisible();
    await page.getByRole('checkbox', { name: /Reformulation targets/ }).check();
    await page.getByRole('checkbox', { name: /Affordable healthier/ }).check();
    // info button toggles the explanation
    const info = page.locator('#q-1\\.1').getByRole('button', { name: /Why we ask/ });
    await info.click();
    await expect(page.locator('#info-1\\.1')).toBeVisible();
    await page.getByRole('radio', { name: 'Some products' }).check();
    await page.getByPlaceholder(/reduced added sugar/).fill('Cut sugar in porridge mix.');

    // simulate offline: answers keep saving on device
    await page.getByRole('button', { name: /Simulate offline/ }).click();
    await expect(page.getByRole('status')).toContainText('Offline (simulated)');
    await page.getByRole('button', { name: 'Next topic' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Marketing/ })).toBeVisible();
    // 2.2 depends on the specific answer "Yes" to 2.1; 2.3 chains on 2.2
    await expect(page.locator('#q-2\\.2')).toHaveCount(0);
    await page.locator('#q-2\\.1').getByRole('radio', { name: 'Yes', exact: true }).check();
    await expect(page.locator('#q-2\\.2')).toBeVisible();
    await expect(page.locator('#q-2\\.3')).toHaveCount(0);
    await page.getByRole('radio', { name: 'Under 13' }).check();
    await expect(page.locator('#q-2\\.3')).toBeVisible();
    await page.getByRole('checkbox', { name: /Television and radio/ }).check();
    await page.getByRole('checkbox', { name: /Packaging and in-store/ }).check();
    await page.locator('#q-2\\.4').getByRole('radio', { name: 'No', exact: true }).check();
    await expect(page.getByText(/Saved on this device: \d/)).toBeVisible();
    // persistence survives a reload while offline
    await page.reload();
    await expect(page.getByText(/questions answered/)).toContainText(/[4-9] of/);
    await page.getByRole('button', { name: 'Back online' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Offline' })).toHaveCount(0);

    // Switching 2.1 to No hides the chain and drops those answers
    await page.getByRole('button', { name: /2\. Marketing/ }).click();
    await page.locator('#q-2\\.1').getByRole('radio', { name: 'No', exact: true }).check();
    await expect(page.locator('#q-2\\.2')).toHaveCount(0);
    await page.locator('#q-2\\.1').getByRole('radio', { name: 'Yes', exact: true }).check();
    await page.getByRole('radio', { name: 'Under 13' }).check();
    await page.getByRole('checkbox', { name: /Television and radio/ }).check();
    await page.getByRole('checkbox', { name: /Packaging and in-store/ }).check();
    await page.locator('#q-2\\.4').getByRole('radio', { name: 'No', exact: true }).check();

    // remaining topics
    await page.getByRole('button', { name: 'Next topic' }).click();
    await page.getByRole('radio', { name: 'Yes, at some sites' }).check();
    await page.getByRole('checkbox', { name: /Healthier food/ }).check();
    await page.getByRole('checkbox', { name: /Nutrition education/ }).check();
    await page.getByRole('button', { name: 'Next topic' }).click();
    await page.getByRole('radio', { name: 'Most products' }).check();
    await page.getByRole('checkbox', { name: /allergen/ }).check();
    await page.getByRole('button', { name: 'Next topic' }).click();
    // submit with unanswered questions: error summary with links
    await page.getByRole('button', { name: 'See my results' }).click();
    await expect(page.getByRole('alert')).toContainText('2 questions still unanswered');
    await page.locator('#q-5\\.1').getByRole('radio', { name: 'No', exact: true }).check();
    await page.getByRole('checkbox', { name: /Industry associations/ }).check();
    await page.getByRole('checkbox', { name: /Government/ }).check();
    await page.getByRole('button', { name: 'See my results' }).click();

    // results
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your results');
    await expect(page.locator('[data-tour="grade"]')).toContainText('Marketing');
    const marketingRow = page.locator('[data-tour="grade"] li').filter({ hasText: 'Marketing' });
    await expect(marketingRow).toContainText('9.5 / 20');
    await expect(marketingRow.locator('.grade')).toHaveText('C');
    // why this score
    const why = page.locator('[data-tour="why"]');
    await expect(why).toContainText('percentage = total points ÷ maximum points');
    await expect(why).toContainText('A ≥ 80 % · B ≥ 60 % · C ≥ 40 % · D ≥ 20 % · E ≥ 0 %');
    await expect(why).toContainText('v1.0');
    await expect(why.getByRole('row').filter({ hasText: 'Under 13' })).toContainText('2.5');
    // roadmap
    await page.getByRole('link', { name: 'See your roadmap' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your roadmap');
    await expect(page.getByRole('heading', { name: /^Now/ })).toBeVisible();
    await expect(page.getByText('Because you answered').first()).toBeVisible();
    await expect(page.locator('li').filter({ hasText: 'Introduce a compliance review' })).toContainText('Because you answered');
    await page.getByLabel('Filter by topic').selectOption('Marketing');
    await expect(page.locator('li').filter({ hasText: 'Complete nutrient declarations' })).toHaveCount(0);
  });

  test('language switch changes the html lang attribute and the questionnaire', async ({ page }) => {
    await resetDemo(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'SW' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'sw');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Anza tathmini yako binafsi');
    await page.getByRole('button', { name: 'Anza tathmini' }).click();
    await expect(page.getByText('Je, kampuni yako ina mkakati wa lishe')).toBeVisible();
  });

  test('assistant: explains the marketing C with sources, declines health questions, hands unknown questions to a person', async ({ page }) => {
    await resetDemo(page);
    await page.getByRole('button', { name: 'Load sample answers' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your results');
    await page.locator('[data-tour="assistant"]').click();
    const dlg = page.getByRole('dialog', { name: /Assistant/ });
    await expect(dlg).toBeVisible();
    await dlg.getByLabel(/Ask about your results/).fill('Why did I get a C on marketing?');
    await dlg.getByRole('button', { name: 'Send' }).click();
    const first = dlg.locator('.msg-bot').nth(0);
    await expect(first).toContainText('Your Marketing result is C');
    await expect(first).toContainText('9.5 of 20');
    await expect(first.locator('.chip')).toContainText(['result v1.0']);
    await expect(first).toContainText('recommendation R-14');
    // health question declined
    await dlg.getByLabel(/Ask about your results/).fill('Is this porridge good for my diabetes?');
    await dlg.getByRole('button', { name: 'Send' }).click();
    const second = dlg.locator('.msg-bot').nth(1);
    await expect(second).toContainText('cannot give health, dietary or medical advice');
    await expect(second.locator('.chip-accent')).toHaveCount(0);
    // unknown → hand-off with ticket number
    await dlg.getByLabel(/Ask about your results/).fill('What is the shipping tariff for containers from Mombasa to Rotterdam?');
    await dlg.getByRole('button', { name: 'Send' }).click();
    const third = dlg.locator('.msg-bot').nth(2);
    await expect(third).toContainText('Send it to the hub team?');
    await third.getByRole('button', { name: /Send to the hub team/ }).click();
    await expect(third).toContainText('ticket HQ-0002');
    await expect(dlg).toContainText('In production the answer text is written by an EU-hosted model strictly from these sources');
    // Esc closes and focus returns to the opener
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('[data-tour="assistant"]')).toBeFocused();
  });

  test('calculator: variants A and B, component table, next-letter hint', async ({ page }) => {
    await resetDemo(page);
    await page.goto('/#/calculator');
    await expect(page.getByText('Illustrative calculation, not a result of ATNi, not a medical recommendation.').first()).toBeVisible();
    const table = page.getByRole('table');
    await expect(table.getByRole('row').filter({ hasText: 'Final score' }).getByRole('cell')).toHaveText(['12', '2']);
    await expect(page.getByText('D → B')).toBeVisible();
    await page.getByLabel('Sugars (g)', { exact: true }).nth(1).fill('30');
    await expect(table.getByRole('row').filter({ hasText: 'Final score' }).getByRole('cell').nth(1)).toHaveText('11'); // N = 15 ≥ 11 ⇒ protein no longer counted
  });
});
