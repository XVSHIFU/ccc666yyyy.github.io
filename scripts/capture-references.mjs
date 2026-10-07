import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

// The ten newly integrated source-inspired appearances only. Existing six
// visual baselines are left untouched. Run once after all templates are mounted.
const origin = process.env.BLOG_TEST_URL || 'http://127.0.0.1:4321';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Reference-theme captures are restricted to the local preview.');
}
const destination = resolve('.impeccable/review');
const themes = ['traveritas', 'radar', 'goodfella', 'ava', 'nfinite', 'followart', 'milkin', 'digilab', 'stefan', 'buro'];
const selectedThemes = process.env.BLOG_CAPTURE_THEMES?.split(',').filter(Boolean) || themes;
if (selectedThemes.some(theme => !themes.includes(theme))) throw new Error('Unknown reference theme selection.');
const captureAppearance = !process.env.BLOG_CAPTURE_THEMES || process.env.BLOG_CAPTURE_APPEARANCE === '1';
const selectedViews = process.env.BLOG_CAPTURE_VIEWS?.split(',').filter(Boolean);
const captures = [
  ...themes.flatMap(theme => ['desktop', 'mobile', 'dark'].map(view => ({ theme, view }))),
  ...['traveritas', 'radar', 'buro'].map(theme => ({ theme, view: 'article' })),
  { theme: 'traveritas', view: 'appearance-desktop' },
  { theme: 'traveritas', view: 'appearance-mobile' },
].filter(capture => (capture.view.startsWith('appearance') ? captureAppearance : selectedThemes.includes(capture.theme))
  && (!selectedViews || selectedViews.includes(capture.view)));
await mkdir(destination, { recursive: true });
await mkdir(resolve('public/previews'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];
const geometry = [];
const thumbnailOrigins = {};

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images];
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.all(images.map(image => image.decode().catch(() => {})));
    window.scrollTo({ top: 0, behavior: 'instant' });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measure(page) {
  return page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const bodyWidth = document.body.scrollWidth;
    const outliers = documentWidth > viewport + 1 || bodyWidth > viewport + 1
      ? [...document.querySelectorAll('body *')].flatMap(element => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return [];
        return rect.right > viewport + 1 || rect.left < -1
          ? [{ tag: element.tagName, class: element.className?.baseVal || element.className, left: rect.left, right: rect.right }]
          : [];
      }).slice(0, 10) : [];
    return { viewport, documentWidth, bodyWidth, outliers };
  });
}

try {
  // Fail before taking partial screenshots if integration is still in progress.
  const readyPage = await browser.newPage();
  await readyPage.goto(new URL('/', origin).href, { waitUntil: 'networkidle' });
  for (const theme of themes) await expect(readyPage.locator(`template[data-home-template="${theme}"]`)).toHaveCount(1);
  await expect(readyPage.locator('[data-theme-option]')).toHaveCount(16);
  await readyPage.close();

  for (const { theme, view } of captures) {
    const mobile = view === 'mobile' || view.endsWith('-mobile');
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
      isMobile: mobile,
      hasTouch: mobile,
      deviceScaleFactor: 1,
      colorScheme: view === 'dark' ? 'dark' : 'light',
      reducedMotion: 'reduce',
    });
    await context.addInitScript(({ selected, mode }) => {
      localStorage.setItem('qinghe-theme', selected);
      localStorage.setItem('qinghe-mode', mode);
    }, { selected: theme, mode: view === 'dark' ? 'dark' : 'light' });
    const page = await context.newPage();
    const failures = [];
    const pendingPreviews = new Set();
    page.on('pageerror', error => failures.push(error.message));
    page.on('response', response => {
      if (response.status() < 400) return;
      // During the first pass, not-yet-rendered thumbnail files legitimately
      // do not exist. They are collected separately, never hidden as app errors.
      if (/\/previews\/[^/]+\.webp$/.test(new URL(response.url()).pathname)) pendingPreviews.add(response.url());
      else failures.push(`${response.status()} ${response.url()}`);
    });
    const path = view === 'article' ? '/posts/a-small-tool/' : '/';
    const response = await page.goto(new URL(path, origin).href, { waitUntil: 'networkidle' });
    if (response?.status() !== 200) throw new Error(`${theme}/${view}: HTTP ${response?.status()}`);
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    if (view !== 'article') await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', theme);
    if (view.startsWith('appearance')) {
      await page.locator('.site-header [data-open-appearance]').click();
      await expect(page.locator('#appearance-dialog')).toBeVisible();
      await page.locator('#appearance-dialog').evaluate(dialog => { dialog.scrollTop = 0; });
      await page.evaluate(async () => {
        await Promise.all([...document.querySelectorAll('#appearance-dialog img')].map(image => image.decode().catch(() => {})));
      });
    }
    const checks = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      mode: document.documentElement.dataset.mode,
      themeStylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link => /\/themes\//.test(link.href)).length,
      brokenImages: [...document.images].filter(image => image.currentSrc && image.naturalWidth === 0 && !/\/previews\//.test(image.currentSrc)).map(image => image.currentSrc),
      brokenPreviewImages: [...document.images].filter(image => image.currentSrc && image.naturalWidth === 0 && /\/previews\//.test(image.currentSrc)).map(image => image.currentSrc),
      activeHome: document.querySelector('#theme-home')?.dataset.homeTheme,
      mainCount: document.querySelectorAll('main').length,
      duplicateIds: [...document.querySelectorAll('[id]')].map(element => element.id).filter((id, index, all) => all.indexOf(id) !== index),
      openDialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id),
    }));
    const dimensions = await measure(page);
    if (selectedViews && view === 'mobile') geometry.push({ theme, requestedWidth: 390, ...dimensions });
    const screenshot = resolve(destination, `${theme}-${view}.png`);
    await page.screenshot({ path: screenshot, fullPage: !view.startsWith('appearance'), animations: 'disabled' });
    if (view === 'desktop') {
      const thumbnail = resolve('public/previews', `${theme}.webp`);
      await sharp(screenshot).extract({ left: 0, top: 0, width: 1440, height: 1000 }).resize(480, 333).webp({ quality: 88 }).toFile(thumbnail);
      const Origin = `Local Playwright rendering of the independent ${theme} homepage at .impeccable/review/${theme}-desktop.png; actual 1440x1000 viewport cropped and resized to 480x333. This is the current project UI, not an upstream image or an AI-generated comp.`;
      const metadata = { Origin, prompt: `Origin: ${Origin}`, source: new URL(`/?theme=${theme}`, origin).href, createdAt: new Date().toISOString(), width: 480, height: 333 };
      await writeFile(`${thumbnail}.json`, `${JSON.stringify(metadata, null, 2)}\n`);
      thumbnailOrigins[`${theme}.webp`] = metadata;
      for (const width of [1280, 1024, 768, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        await settle(page);
        geometry.push({ theme, requestedWidth: width, ...await measure(page) });
      }
    }
    report.push({ theme, view, path, screenshot, ...checks, ...dimensions, failures, pendingPreviews: [...pendingPreviews] });
    console.log(`${theme}-${view}.png: ${dimensions.documentWidth}/${dimensions.viewport}px; ${failures.length} errors`);
    await context.close();
  }
  const originsPath = resolve('public/previews/origin.json');
  let priorOrigins = {};
  try { priorOrigins = JSON.parse(await readFile(originsPath, 'utf8')); } catch {}
  await writeFile(originsPath, `${JSON.stringify({ ...priorOrigins, ...thumbnailOrigins }, null, 2)}\n`);
  async function mergeReport(file, current, key) {
    let previous = [];
    if (process.env.BLOG_CAPTURE_THEMES) {
      try { previous = JSON.parse(await readFile(resolve(destination, file), 'utf8')); } catch {}
    }
    const merged = new Map(previous.map(item => [key(item), item]));
    current.forEach(item => merged.set(key(item), item));
    await writeFile(resolve(destination, file), `${JSON.stringify([...merged.values()], null, 2)}\n`);
  }
  await mergeReport('references-capture-report.json', report, item => `${item.theme}/${item.view}`);
  await mergeReport('references-responsive-geometry.json', geometry, item => `${item.theme}/${item.requestedWidth}`);
  const defects = report.filter(item => item.failures.length || item.brokenImages.length || item.mainCount !== 1 || item.themeStylesheets !== 1 || item.duplicateIds.length || item.documentWidth > item.viewport + 1 || item.bodyWidth > item.viewport + 1 || item.view.startsWith('appearance') && item.brokenPreviewImages.length);
  const overflow = geometry.filter(item => item.documentWidth > item.viewport + 1 || item.bodyWidth > item.viewport + 1);
  console.log(`Captured ${report.length} views; ${defects.length} capture issues; ${overflow.length}/${geometry.length} geometry overflow cases.`);
  if (defects.length || overflow.length) process.exitCode = 1;
} finally {
  await browser.close();
}
