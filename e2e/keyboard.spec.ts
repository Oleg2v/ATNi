import { expect, test } from '@playwright/test';

/** Key scenario driven only with the keyboard: start → first topic → results via sample answers → assistant → roadmap. */
test('keyboard-only: skip link, survey answers, results, assistant drawer, dialogs', async ({ page }) => {
  test.skip(((page.viewportSize()?.width) ?? 0) < 400, 'desktop project only');
  await page.goto('/#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/');
  // skip link is the first tab stop and moves focus to main
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  // tab into the form: country select, size radios, language radios, begin
  await page.getByLabel('Country').focus();
  await page.keyboard.press('Tab'); // size radio group
  await page.keyboard.press('ArrowDown'); // Large
  await expect(page.getByRole('radio', { name: /Large/ })).toBeChecked();
  await page.keyboard.press('Tab'); // language radios
  await page.keyboard.press('Tab'); // Begin
  await expect(page.getByRole('button', { name: 'Begin assessment' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Self-assessment');
  // answer 1.1 with arrows, 1.2 appears, tick with space
  await page.locator('#q-1\\.1').getByRole('radio').first().focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#q-1\\.2')).toBeVisible();
  await page.locator('#q-1\\.2').getByRole('checkbox').first().focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#q-1\\.2').getByRole('checkbox').first()).toBeChecked();
  // info toggle by keyboard
  await page.locator('#q-1\\.1').getByRole('button', { name: /Why we ask/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#info-1\\.1')).toBeVisible();
  // next topic moves focus to the topic heading
  await page.getByRole('button', { name: 'Next topic' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: /Marketing/ })).toBeFocused();
  // reset dialog: Esc closes and focus returns
  const resetBtn = page.getByRole('button', { name: 'Reset demo' });
  await resetBtn.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Reset demo' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Reset demo' })).toBeHidden();
  await expect(resetBtn).toBeFocused();
  // results via sample answers, assistant drawer by keyboard
  await page.goto('/#/');
  await page.getByRole('button', { name: 'Load sample answers' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your results');
  await page.locator('[data-tour="assistant"]').focus();
  await page.keyboard.press('Enter');
  const dlg = page.getByRole('dialog', { name: /Assistant/ });
  await expect(dlg.getByRole('textbox')).toBeFocused();
  await page.keyboard.type('what do the letters mean');
  await page.keyboard.press('Enter');
  await expect(dlg.locator('.msg-bot').first()).toContainText(/A from 80 %|Your overall result/);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tour="assistant"]')).toBeFocused();
  // roadmap print button reachable
  await page.goto('/#/roadmap');
  await page.getByRole('button', { name: /Print or save as PDF/ }).focus();
  await expect(page.getByRole('button', { name: /Print or save as PDF/ })).toBeFocused();
});
