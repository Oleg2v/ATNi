import { expect, test } from '@playwright/test';

test('guided tour: six steps across routes, keyboard operable, focus returns to the start button', async ({ page }) => {
  test.skip(((page.viewportSize()?.width) ?? 0) < 400, 'desktop project only');
  await page.goto('/#/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#/evaluators');
  await page.locator('#start-tour').focus();
  await page.keyboard.press('Enter');
  const box = page.getByRole('dialog').filter({ hasText: /Step 1 of 6/ });
  await expect(box).toBeVisible();
  await expect(page).toHaveURL(/#\/results/);
  await expect(page.locator('[data-tour="grade"]')).toHaveClass(/tour-highlight/);
  // heading of the box receives focus
  await expect(box.getByRole('heading')).toBeFocused();
  const next = () => page.getByRole('button', { name: /^Next/ }).click();
  await next();
  await expect(page.getByRole('dialog').filter({ hasText: /Step 2 of 6/ })).toBeVisible();
  await expect(page.locator('[data-tour="why"]')).toHaveClass(/tour-highlight/);
  await next();
  await expect(page).toHaveURL(/#\/roadmap/);
  await expect(page.locator('[data-tour="roadmap"]')).toHaveClass(/tour-highlight/);
  await next();
  await expect(page.locator('[data-tour="assistant"]')).toHaveClass(/tour-highlight/);
  await next();
  await expect(page).toHaveURL(/#\/admin\/methodology\/v1\.1/);
  await expect(page.locator('[data-tour="publish"]')).toHaveClass(/tour-highlight/);
  await next();
  await expect(page.getByRole('dialog').filter({ hasText: /Step 6 of 6/ })).toBeVisible();
  await expect(page.locator('[data-tour="history"]')).toHaveClass(/tour-highlight/);
  await page.getByRole('button', { name: /Finish/ }).click();
  await expect(page).toHaveURL(/#\/evaluators/);
  await expect(page.locator('#start-tour')).toBeFocused();
  await expect(page.locator('.tour-highlight')).toHaveCount(0);
  // Esc skips
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').filter({ hasText: /Step 1 of 6/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog').filter({ hasText: /Step/ })).toHaveCount(0);
});
