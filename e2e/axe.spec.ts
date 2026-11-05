import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = ['/', '/assess', '/results', '/roadmap', '/calculator', '/investors', '/policy', '/account', '/evaluators', '/accessibility', '/admin', '/admin/methodology', '/admin/methodology/v1.1', '/admin/health', '/admin/import', '/admin/analytics', '/admin/tickets', '/admin/audit', '/admin/countries', '/admin/translations', '/admin/settings', '/admin/users'];

test.describe('axe-core on every route', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 400, 'desktop project only');
  for (const route of ROUTES) {
    test(`no violations at ${route}`, async ({ page }) => {
      await page.goto('/#/');
      await page.evaluate(() => localStorage.clear());
      // sample result so results/roadmap/assistant have content; admin role for admin routes
      await page.getByRole('button', { name: 'Load sample answers' }).click();
      await page.getByLabel(/Demo role switcher/).selectOption('admin');
      await page.goto(`/#${route}`);
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious' || v.impact === 'moderate' || v.impact === 'minor');
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
    });
  }
});
