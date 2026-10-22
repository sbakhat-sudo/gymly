import { chromium } from 'playwright';

const BASE = 'http://localhost:8081';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

console.log('URL after initial load:', page.url());

// Try to find and fill a login form (Manager test account).
const emailInput = page.locator('input[type="email"], input[placeholder*="mail" i]').first();
const hasEmail = await emailInput.count();
console.log('email input found:', hasEmail);

if (hasEmail) {
  await emailInput.fill('manager.flow.test@gymly.test');
  const pwInput = page.locator('input[type="password"]').first();
  await pwInput.fill('ManagerNuovo123!');
  const submit = page.getByRole('button', { name: /accedi|login|entra/i }).first();
  await submit.click();
  await page.waitForTimeout(3000);
}

console.log('URL after login attempt:', page.url());
await page.screenshot({ path: 'C:/Users/saadb/AppData/Local/Temp/claude/c--Users-saadb-OneDrive-Desktop-expo-projets/b3ccec88-0385-4129-a106-f839f79b9bf4/scratchpad/after-login.png' });

await page.waitForTimeout(1000);

// Start a rAF frame-timing probe in the page.
await page.evaluate(() => {
  window.__frames = [];
  window.__rafStart = performance.now();
  function tick(t) {
    window.__frames.push(t);
    if (performance.now() - window.__rafStart < 1500) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);
});

// Hover near the left edge where the sidebar gutter is reserved.
await page.mouse.move(40, 300);
await page.waitForTimeout(400);
await page.screenshot({ path: 'C:/Users/saadb/AppData/Local/Temp/claude/c--Users-saadb-OneDrive-Desktop-expo-projets/b3ccec88-0385-4129-a106-f839f79b9bf4/scratchpad/hovered.png' });

// Move away to trigger collapse too.
await page.mouse.move(700, 300);
await page.waitForTimeout(1200);

const frames = await page.evaluate(() => window.__frames);
const deltas = [];
for (let i = 1; i < frames.length; i++) deltas.push(frames[i] - frames[i - 1]);
const maxDelta = Math.max(...deltas);
const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
const longFrames = deltas.filter((d) => d > 32).length;
console.log('frame count:', frames.length, 'avg delta ms:', avgDelta.toFixed(2), 'max delta ms:', maxDelta.toFixed(2), 'long frames (>32ms):', longFrames);
console.log('deltas sample:', deltas.slice(0, 40).map((d) => d.toFixed(1)).join(','));

await browser.close();
