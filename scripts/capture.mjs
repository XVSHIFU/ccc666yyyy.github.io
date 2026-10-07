import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

// One bounded visual-review pass; run after the interaction tests pass.
const origin = process.env.BLOG_TEST_URL || 'http://127.0.0.1:4321';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
  throw new Error('Review captures are restricted to the local development server.');
}
const destination = resolve('.impeccable/review');
const themes = ['koharu', 'firefly', 'shirone', 'solitude', 'redefine', 'cactus'];
const captures = [
  ...themes.flatMap(theme => ['desktop', 'mobile', 'article', 'dark'].map(view => ({ theme, view }))),
  ...['article-mobile', 'appearance-desktop', 'appearance-mobile', 'search'].map(view => ({ theme: 'firefly', view })),
  ...['koharu', 'firefly', 'shirone'].flatMap(theme => ['scrolled-desktop', 'scrolled-mobile'].map(view => ({ theme, view }))),
  { theme: 'koharu', view: 'drawer-mobile' },
];
const browser = await chromium.launch({ headless: true });
const report = [];
const geometry = [];
await mkdir(destination, { recursive: true });
await mkdir(resolve('public/previews'), { recursive: true });

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

try {
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
      await context.addInitScript(({ chosenTheme, mode }) => {
        localStorage.setItem('qinghe-theme', chosenTheme);
        localStorage.setItem('qinghe-mode', mode);
      }, { chosenTheme: theme, mode: view === 'dark' ? 'dark' : 'light' });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', error => failures.push(error.message));
      page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
      const path = view.startsWith('article') ? '/posts/a-small-tool/' : '/';
      const response = await page.goto(new URL(path, origin).href, { waitUntil: 'networkidle' });
      if (response?.status() !== 200) throw new Error(`${theme}/${view} did not load successfully.`);
      await settle(page);
      if (view.startsWith('appearance')) {
        await page.locator('.site-header').getByRole('button', { name: '外观', exact: true }).click();
        await expect(page.getByRole('dialog', { name: '挑一个喜欢的世界' })).toBeVisible();
      } else if (view === 'search') {
        await page.locator('.site-header').getByRole('button', { name: '搜索文章', exact: true }).click();
        await page.getByRole('searchbox').fill('原有顺序');
        await expect(page.locator('#search-results').getByRole('link')).toHaveCount(1);
      } else if (view.startsWith('scrolled')) {
        const bannerBottom = await page.locator('#theme-home .k-cover, #theme-home .f-banner, #theme-home .shirone-banner').evaluate(element => element.getBoundingClientRect().bottom);
        await page.mouse.move(mobile ? 195 : 720, mobile ? 790 : 950);
        await page.mouse.wheel(0, bannerBottom + 180);
        await expect(page.locator('html')).toHaveAttribute('data-nav-scrolled', 'true');
        if (theme === 'firefly') {
          await expect(page.locator('html')).toHaveAttribute('data-nav-hidden', 'true');
          await page.mouse.wheel(0, -100);
          await expect(page.locator('html')).toHaveAttribute('data-nav-hidden', 'false');
        }
        await expect(page.locator('.site-header').getByRole('button', { name: '外观', exact: true })).toBeInViewport();
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      } else if (view === 'drawer-mobile') {
        await page.locator('.mobile-nav-toggle').click();
        const drawer = page.getByRole('dialog', { name: '小站导航', exact: true });
        await expect(drawer).toBeVisible();
        await drawer.getByRole('img').evaluate(image => image.decode());
      }
      const checks = await page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        mode: document.documentElement.dataset.mode,
        viewport: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        themeStylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].filter(link => /\/themes\//.test(link.href)).length,
        brokenImages: [...document.images].filter(image => image.currentSrc && image.naturalWidth === 0).map(image => image.currentSrc),
        activeHome: document.querySelector('#theme-home')?.dataset.homeTheme,
        mainCount: document.querySelectorAll('main').length,
        duplicateIds: [...document.querySelectorAll('[id]')].map(element => element.id).filter((id, index, all) => all.indexOf(id) !== index),
        scrollY,
        navScrolled: document.documentElement.dataset.navScrolled,
        navHidden: document.documentElement.dataset.navHidden,
        header: (() => { const rect = document.querySelector('.site-header').getBoundingClientRect(); return { top: rect.top, bottom: rect.bottom }; })(),
        openDialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.id),
      }));
      const screenshot = resolve(destination, `${theme}-${view}.png`);
      await page.screenshot({ path: screenshot, fullPage: !view.startsWith('appearance') && !view.startsWith('scrolled') && view !== 'search' && view !== 'drawer-mobile', animations: 'disabled' });
      if (view === 'desktop') {
        const thumbnail = resolve('public/previews', `${theme}.webp`);
        await sharp(screenshot).extract({ left: 0, top: 0, width: 1440, height: 1000 }).resize(480, 333).webp({ quality: 88 }).toFile(thumbnail);
        let prior = {};
        try { prior = JSON.parse(await readFile(`${thumbnail}.json`, 'utf8')); } catch {}
        const Origin = `Local Playwright rendering of the independent ${theme} homepage at .impeccable/review/${theme}-desktop.png; 1440x1000 viewport, first 1000px cropped and resized to 480x333. Actual current project UI, not an AI-generated comp or upstream screenshot.`;
        await writeFile(`${thumbnail}.json`, `${JSON.stringify({ ...prior, Origin, prompt: `Origin: ${Origin}`, createdAt: new Date().toISOString() }, null, 2)}\n`);
        // One responsive-geometry pass; these widths do not create extra captures.
        for (const width of [1280, 1024, 768, 390]) {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
          await settle(page);
          const dimensions = await page.evaluate(() => {
            const viewport = document.documentElement.clientWidth;
            const documentWidth = document.documentElement.scrollWidth;
            const outliers = documentWidth > viewport + 1 ? [...document.querySelectorAll('body *')].flatMap(element => {
              const rect = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              if (rect.width < 1 || rect.height < 1 || style.visibility === 'hidden' || style.display === 'none') return [];
              return rect.right > viewport + 1 ? [{ tag: element.tagName, class: element.className?.baseVal || element.className, left: rect.left, right: rect.right }] : [];
            }).slice(0, 8) : [];
            return { viewport, documentWidth, bodyWidth: document.body.scrollWidth, outliers };
          });
          geometry.push({ theme, requestedWidth: width, ...dimensions });
        }
      }
      report.push({ theme, view, path, ...checks, failures });
      console.log(`${theme}-${view}.png: ${checks.documentWidth}/${checks.viewport}px, ${failures.length} errors`);
      await context.close();
  }
  await writeFile(resolve(destination, 'capture-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(resolve(destination, 'responsive-geometry.json'), `${JSON.stringify(geometry, null, 2)}\n`);
  console.log(`Responsive overflow cases: ${geometry.filter(item => item.documentWidth > item.viewport + 1 || item.bodyWidth > item.viewport + 1).length}/${geometry.length}`);
} finally {
  await browser.close();
}
