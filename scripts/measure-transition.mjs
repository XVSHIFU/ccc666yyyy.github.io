import { chromium, expect } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const origin = process.env.BLOG_TEST_URL || 'http://127.0.0.1:4321';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Local preview only.');
const browser = await chromium.launch();
const samples = [];
try {
  for (const variant of [
    { name: 'desktop', width: 1440, height: 1000, motion: 'no-preference' },
    { name: 'mobile', width: 390, height: 844, motion: 'no-preference' },
  ]) {
    const context = await browser.newContext({ viewport: { width: variant.width, height: variant.height }, reducedMotion: variant.motion, colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto(`${origin}/?theme=cactus`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    for (const target of ['firefly']) {
      const trigger = await page.locator('.site-header [data-open-appearance]').boundingBox();
      await page.mouse.click(trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
      await expect(page.locator('#appearance-dialog')).toBeVisible();
      await page.evaluate(target => {
        const sample = { from: document.documentElement.dataset.theme, target, click: 0, overlay: 0, covered: 0, applied: 0, finished: 0, frames: [], resourcesStart: performance.getEntriesByType('resource').length };
        window.__inkMetrics = sample;
        let frame = 0;
        const observeFrame = now => { sample.frames.push(now); frame = requestAnimationFrame(observeFrame); };
        const observer = new MutationObserver(() => {
          if (!sample.click) return;
          const ink = document.querySelector('#theme-transition');
          const now = performance.now();
          if (ink && !sample.overlay) sample.overlay = now;
          if (ink?.dataset.phase === 'covered' && !sample.covered) sample.covered = now;
          if (document.documentElement.dataset.theme === target && !sample.applied) sample.applied = now;
          if (sample.overlay && !ink) { sample.finished = now; cancelAnimationFrame(frame); observer.disconnect(); }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-phase', 'data-theme'] });
        document.querySelector(`[data-theme-option="${target}"]`).addEventListener('click', () => {
          sample.click = performance.now();
          frame = requestAnimationFrame(observeFrame);
        }, { once: true, capture: true });
      }, target);
      const bounds = await page.locator(`[data-theme-option="${target}"]`).boundingBox();
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await expect(page.locator('html')).toHaveAttribute('data-theme', target);
      await expect(page.locator('#theme-transition')).toHaveCount(0);
      await expect(page.locator('#appearance-dialog')).not.toHaveAttribute('aria-busy', 'true');
      const sample = await page.evaluate(() => {
        const s = window.__inkMetrics;
        const round = value => Math.round(value * 10) / 10;
        const deltas = s.frames.slice(1).map((time, index) => time - s.frames[index]).sort((a, b) => a - b);
        const percentile = value => deltas.length ? round(deltas[Math.min(deltas.length - 1, Math.ceil(deltas.length * value) - 1)]) : null;
        return {
          from: s.from, to: s.target,
          clickToOverlayMs: round(s.overlay - s.click), clickToCoveredMs: round(s.covered - s.click),
          clickToThemeAppliedMs: round(s.applied - s.click), clickToRevealedMs: round(s.finished - s.click),
          rafSamples: s.frames.length, rafMedianMs: percentile(.5), rafP95Ms: percentile(.95), rafMaxMs: percentile(1),
          cssRequests: performance.getEntriesByType('resource').slice(s.resourcesStart).filter(entry => /\/themes\/[^/]+\.css$/.test(new URL(entry.name).pathname)).map(entry => ({ path: new URL(entry.name).pathname, durationMs: round(entry.duration), transferSize: entry.transferSize })),
        };
      });
      samples.push({ variant: variant.name, viewport: `${variant.width}x${variant.height}`, reducedMotion: variant.motion, ...sample });
      console.log(JSON.stringify(samples.at(-1)));
    }
    await context.close();
  }
  const report = {
    measuredAt: new Date().toISOString(), origin,
    method: 'Headless local Chromium, actual mouse clicks and real performance.now/requestAnimationFrame. No virtual clock. One desktop and one mobile sample, not a device or network guarantee.',
    baseline: 'Unavailable: the old preview refused connections before implementation changed. No before/after performance claim is made.',
    samples,
  };
  await mkdir(resolve('.impeccable/review'), { recursive: true });
  await writeFile(resolve('.impeccable/review/transition-performance.json'), `${JSON.stringify(report, null, 2)}\n`);
} finally { await browser.close(); }
