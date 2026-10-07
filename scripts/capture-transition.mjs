import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.BLOG_TEST_URL || 'http://127.0.0.1:4321';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local preview only.');
const destination = resolve('.impeccable/review');
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const view of [{ name: 'desktop', width: 1440, height: 1000, tone: 'light' }, { name: 'mobile', width: 390, height: 844, tone: 'light' }, { name: 'dark', width: 1440, height: 1000, tone: 'dark' }]) {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, reducedMotion: 'no-preference', colorScheme: view.tone, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-07T00:00:00Z') });
    await page.goto(`${origin}/?theme=cactus`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); }));
    });
    await page.locator('.site-header [data-open-appearance]').click();
    await expect(page.locator('#appearance-dialog')).toBeVisible();
    let release;
    const download = new Promise(resolve => { release = resolve; });
    await page.route('**/themes/firefly.css', async route => { await download; await route.continue(); });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    const choice = page.locator('[data-theme-option="firefly"]');
    await choice.scrollIntoViewIfNeeded();
    const target = await choice.boundingBox();
    const click = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    const cdp = await context.newCDPSession(page);
    const snapshot = async (stage, elapsedVirtualMs) => {
      const state = await page.evaluate(() => {
        const ink = document.querySelector('#theme-transition');
        const canvas = ink?.querySelector('canvas');
        let paintedFraction = null;
        if (canvas && !canvas.hidden) {
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          let painted = 0, sampled = 0;
          for (let index = 3; index < pixels.length; index += 64) { sampled++; if (pixels[index] > 10) painted++; }
          paintedFraction = Math.round(painted / sampled * 1000) / 1000;
        }
        const feedback = ink?.querySelector('.ink-transition-feedback');
        return { phase: ink?.dataset.phase || 'revealed', theme: document.documentElement.dataset.theme, originX: ink?.dataset.originX, originY: ink?.dataset.originY, paintedFraction, feedbackOpacity: feedback ? Number(getComputedStyle(feedback).opacity) : null, viewport: document.documentElement.clientWidth, documentWidth: document.documentElement.scrollWidth, openDialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id) };
      });
      // CDP captures the already painted canvas without advancing the virtual
      // clock or fast-forwarding the animation as screenshot animations:disable would.
      const capture = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
      const file = `ink-${view.name}-${stage}.png`;
      await writeFile(resolve(destination, file), Buffer.from(capture.data, 'base64'));
      report.push({ file, viewport: `${view.width}x${view.height}`, requestedCoverTime: stage, elapsedVirtualMs, click, ...state, errors: [...errors] });
      console.log(file, state.phase, state.theme, state.paintedFraction);
    };
    try {
      await page.mouse.click(click.x, click.y);
      await expect(page.locator('#theme-transition')).toHaveAttribute('data-phase', 'covering');
      await page.clock.runFor(180);
      await snapshot('20', 180);
      await page.clock.runFor(360);
      await snapshot('60', 540);
      await page.clock.runFor(610);
      await expect(page.locator('#theme-transition')).toHaveAttribute('data-phase', 'covered');
      // Let the feedback compositor finish its entrance at this settled pause.
      await new Promise(resolve => setTimeout(resolve, 150));
      await snapshot('covered', 1150);
      const response = page.waitForResponse('**/themes/firefly.css');
      release();
      await response;
      await page.clock.runFor(600);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'firefly');
      await page.evaluate(() => document.fonts.ready);
      await snapshot('revealing', 1750);
      await page.clock.runFor(750);
      await expect(page.locator('#theme-transition')).toHaveCount(0);
      await expect(page.locator('#appearance-dialog')).not.toBeVisible();
      await page.evaluate(async () => {
        await Promise.all([...document.querySelectorAll('#theme-home img:not([loading="lazy"])')].map(image => image.decode().catch(() => {})));
      });
      await snapshot('revealed', 2500);
    } finally { release(); await context.close(); }
  }
  await writeFile(resolve(destination, 'ink-capture-report.json'), `${JSON.stringify({ method: 'Virtual-clock visual snapshots only. Cover duration is 900ms with a progress^1.45 front curve; 20/60 label elapsed animation time, not ink area. Covered pause is at least 550ms before the 650ms reveal (progress^1.25). The covered snapshot is at 1150ms, with another 150ms real wall time for compositor feedback. The clicked tile is scrolled into view before capturing its origin. Real performance must be measured separately.', captures: report }, null, 2)}\n`);
} finally { await browser.close(); }
