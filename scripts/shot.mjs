import { chromium } from 'playwright';
const out = process.argv[2];
const routes = process.argv.slice(3);
const browser = await chromium.launch();
for (const width of [1280, 360]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 360 ? 740 : 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  for (const r of routes) {
    await page.goto(`http://127.0.0.1:4173/#${r}`);
    await page.waitForTimeout(400);
    const name = r.replace(/[^a-z0-9]+/gi, '_') || 'root';
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  }
  console.log(width, 'errors:', errors);
  await ctx.close();
}
await browser.close();
