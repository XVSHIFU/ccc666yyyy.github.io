import { expect, test, type Page } from '@playwright/test';

test.use({ reducedMotion: 'no-preference' });

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function openSettings(page: Page) {
  await page.goto('/?theme=cactus', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.site-header [data-open-appearance]').click();
  await expect(page.locator('#appearance-dialog')).toBeVisible();
}

async function choose(page: Page, theme: string) {
  const choice = page.locator(`[data-theme-option="${theme}"]`);
  await choice.scrollIntoViewIfNeeded();
  const bounds = (await choice.boundingBox())!;
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.click(point.x, point.y);
  return point;
}

async function expectSettled(page: Page, theme: string) {
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.locator('#theme-transition')).toHaveCount(0);
  await expect(page.locator('#appearance-dialog')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#theme-sheet')).toHaveCount(1);
  await expect(page.locator('link[data-pending-theme]')).toHaveCount(0);
}

test('ink starts at the clicked card while CSS is pending and reveals only the selected home', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openSettings(page);
  const download = gate();
  await page.route('**/themes/firefly.css', async route => {
    await download.promise;
    await route.continue().catch(() => {});
  });
  const oldMain = await page.locator('main').elementHandle();
  const oldUrl = page.url();
  try {
    const point = await choose(page, 'firefly');
    const ink = page.locator('#theme-transition');
    await expect(ink).toBeVisible();
    expect(await ink.evaluate(element => element.matches(':modal'))).toBe(true);
    expect(Math.abs(Number(await ink.getAttribute('data-origin-x')) - point.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(Number(await ink.getAttribute('data-origin-y')) - point.y)).toBeLessThanOrEqual(1);
    await expect(ink.locator('canvas')).toBeVisible();
    await expect(ink.getByRole('status')).toHaveText('正在切换至 Firefly');
    await expect(ink).toHaveAttribute('data-phase', 'covered');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cactus');
    expect(await oldMain!.evaluate(node => node.isConnected)).toBe(true);
    download.release();
    await expectSettled(page, 'firefly');
    await expect(page.locator('#appearance-dialog')).not.toBeVisible();
    await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', 'firefly');
    await expect(page.locator('main')).toHaveCount(1);
    expect(new URL(page.url()).pathname).toBe(new URL(oldUrl).pathname);
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    expect(errors).toEqual([]);
  } finally { download.release(); }
});

test('the ink waits for an uncached target hero image before committing the next layout', async ({ page }) => {
  await openSettings(page);
  const imageDownload = gate();
  await page.route('**/media/spring.webp?ink-resource-test', async route => {
    await imageDownload.promise;
    await route.continue().catch(() => {});
  });
  await page.evaluate(() => {
    const template = document.querySelector<HTMLTemplateElement>('template[data-home-template="koharu"]')!;
    template.content.querySelector('img[fetchpriority="high"]')!.setAttribute('src', '/media/spring.webp?ink-resource-test');
  });
  try {
    const requested = page.waitForRequest('**/media/spring.webp?ink-resource-test');
    await choose(page, 'koharu');
    await requested;
    const ink = page.locator('#theme-transition');
    await expect(ink).toHaveAttribute('data-phase', 'covered');
    await expect(ink.getByRole('button', { name: '取消切换', exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cactus');
    await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', 'cactus');
    imageDownload.release();
    await expectSettled(page, 'koharu');
    const image = page.locator('#theme-home img[src$="?ink-resource-test"]');
    await expect(image).toBeVisible();
    expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  } finally { imageDownload.release(); }
});

test('normal motion holds the fully covered page before committing the new theme', async ({ page }) => {
  await openSettings(page);
  await page.clock.install();
  const download = gate();
  await page.route('**/themes/firefly.css', async route => {
    await download.promise;
    await route.continue().catch(() => {});
  });
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  try {
    await choose(page, 'firefly');
    await page.clock.runFor(960);
    await expect(page.locator('#theme-transition')).toHaveAttribute('data-phase', 'covered');
    await expect(page.locator('#theme-transition')).toHaveAttribute('data-tone', 'light');
    const response = page.waitForResponse('**/themes/firefly.css');
    download.release();
    await response;
    // Cached resources must not skip the deliberately readable covered pause.
    await page.clock.runFor(350);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'cactus');
    await expect(page.locator('#theme-transition')).toHaveAttribute('data-phase', 'covered');
    await page.clock.runFor(250);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'firefly');
    await page.clock.runFor(850);
    await expectSettled(page, 'firefly');
  } finally { download.release(); }
});

for (const tone of ['light', 'dark'] as const) {
  test(`covered ink uses neutral ${tone} paper, opaque pixels and a bounded canvas`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tone });
    await openSettings(page);
    const download = gate();
    await page.route('**/themes/firefly.css', async route => {
      await download.promise;
      await route.continue().catch(() => {});
    });
    try {
      await choose(page, 'firefly');
      const ink = page.locator('#theme-transition');
      await expect(ink).toHaveAttribute('data-phase', 'covered');
      await expect(ink).toHaveAttribute('data-tone', tone);
      const pixels = await ink.locator('canvas').evaluate(element => {
        const canvas = element as HTMLCanvasElement;
        const context = canvas.getContext('2d')!;
        const samples: number[][] = [];
        for (let y = 0; y <= 10; y++) for (let x = 0; x <= 10; x++) {
          samples.push([...context.getImageData(Math.min(canvas.width - 1, Math.floor(x / 10 * canvas.width)), Math.min(canvas.height - 1, Math.floor(y / 10 * canvas.height)), 1, 1).data]);
        }
        return { samples, backingPixels: canvas.width * canvas.height };
      });
      expect(pixels.backingPixels).toBeLessThanOrEqual(2_205_000);
      for (const [red, green, blue, alpha] of pixels.samples) {
        expect(alpha, 'The covered phase must conceal the old layout at every sampled point').toBe(255);
        expect(Math.max(red, green, blue) - Math.min(red, green, blue), 'Neutral paper must not regress to cyan or a saturated tint').toBeLessThanOrEqual(16);
      }
      const average = pixels.samples.reduce((sum, pixel) => sum + (pixel[0] + pixel[1] + pixel[2]) / 3, 0) / pixels.samples.length;
      if (tone === 'light') expect(average, 'Light paper must avoid a full black wash').toBeGreaterThan(175);
      else expect(average, 'Dark mode must avoid a bright full-screen flash').toBeLessThan(110);
      await page.keyboard.press('Escape');
      await expectSettled(page, 'cactus');
    } finally { download.release(); }
  });
}

for (const action of ['Escape', 'button'] as const) {
  test(`canceling with ${action} retains the old layout, settings and preference`, async ({ page }) => {
    await openSettings(page);
    const download = gate();
    await page.route('**/themes/koharu.css', async route => {
      await download.promise;
      await route.continue().catch(() => {});
    });
    const oldMain = await page.locator('main').elementHandle();
    try {
      await choose(page, 'koharu');
      const ink = page.locator('#theme-transition');
      await expect(ink).toBeVisible();
      if (action === 'Escape') await page.keyboard.press('Escape');
      else await ink.getByRole('button', { name: '取消切换', exact: true }).click();
      await expectSettled(page, 'cactus');
      expect(await oldMain!.evaluate(node => node.isConnected && node === document.querySelector('main'))).toBe(true);
      await expect(page.locator('#appearance-dialog')).toBeVisible();
      await expect(page.locator('#appearance-status')).toContainText('已取消切换');
      await expect(page.locator('[data-theme-option="cactus"]')).toBeFocused();
      expect(await page.evaluate(() => localStorage.getItem('qinghe-theme'))).not.toBe('koharu');
      download.release();
      await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', 'cactus');
    } finally { download.release(); }
  });
}

test('an unavailable target image ends the ink and retains the previous page', async ({ page }) => {
  await openSettings(page);
  await page.evaluate(() => {
    const template = document.querySelector<HTMLTemplateElement>('template[data-home-template="koharu"]')!;
    template.content.querySelector('img[fetchpriority="high"]')!.setAttribute('src', '/media/spring.webp?ink-error-test');
  });
  await page.route('**/media/spring.webp?ink-error-test', route => route.abort());
  await choose(page, 'koharu');
  await expect(page.locator('#appearance-status')).toContainText('外观加载失败');
  await expectSettled(page, 'cactus');
  await expect(page.locator('#appearance-dialog')).toBeVisible();
  await expect(page.locator('#main-content')).toBeVisible();
});

test('the currently selected theme does not create an ink layer', async ({ page }) => {
  await openSettings(page);
  await choose(page, 'cactus');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('#theme-transition')).toHaveCount(0);
  await expect(page.locator('#appearance-dialog')).toBeVisible();
  await expect(page.locator('#appearance-dialog')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#theme-sheet')).toHaveAttribute('href', /\/themes\/cactus\.css$/);
});

test('reduced motion uses a plain fade without the spreading canvas', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openSettings(page);
  const download = gate();
  await page.route('**/themes/firefly.css', async route => {
    await download.promise;
    await route.continue().catch(() => {});
  });
  try {
    await choose(page, 'firefly');
    const ink = page.locator('#theme-transition');
    await expect(ink).toHaveAttribute('data-motion', 'fade');
    await expect(ink.locator('canvas')).toBeHidden();
    await expect(ink).toHaveAttribute('data-phase', 'covered');
    download.release();
    await expectSettled(page, 'firefly');
    await expect(page.locator('#appearance-dialog')).not.toBeVisible();
  } finally { download.release(); }
});
