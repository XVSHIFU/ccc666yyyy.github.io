import { expect, test, type Page } from '@playwright/test';

const originalThemes = ['koharu', 'firefly', 'shirone', 'solitude', 'redefine', 'cactus'] as const;
const referenceThemes = ['traveritas', 'radar', 'goodfella', 'ava', 'nfinite', 'followart', 'milkin', 'digilab', 'stefan', 'buro'] as const;
const themes = [...originalThemes, ...referenceThemes] as const;
const articlePath = '/posts/a-small-tool/';
const testOrigin = new URL(process.env.BLOG_TEST_URL || 'http://127.0.0.1:4321').origin;
const errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const messages: string[] = [];
  errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
});

test.afterEach(async ({ page }) => {
  expect(errors.get(page) || [], 'The reader must not encounter unhandled JavaScript errors').toEqual([]);
});

async function visit(page: Page, path = '/') {
  const response = await page.goto(path, { waitUntil: 'networkidle' });
  expect(response?.status(), `GET ${path}`).toBe(200);
  await expect(page.locator('#main-content')).toBeVisible();
}

async function openAppearance(page: Page) {
  const dialog = page.locator('#appearance-dialog');
  if (!(await dialog.isVisible())) {
    const trigger = page.locator('.site-header').getByRole('button', { name: '外观', exact: true });
    const bounds = await trigger.boundingBox();
    const viewport = page.viewportSize();
    if (bounds && viewport && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height) {
      // Click the visible sticky control as a reader would. Locator.click() may
      // scroll its ancestor even when the sticky button is already on screen.
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    } else {
      await trigger.click();
    }
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectTheme(page: Page, theme: (typeof themes)[number], close = true) {
  const dialog = await openAppearance(page);
  const option = dialog.locator(`[data-theme-option="${theme}"]`);
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#theme-sheet')).toHaveAttribute('href', new RegExp(`/themes/${theme}\\.css$`));
  await expect(page.locator('#theme-transition')).toHaveCount(0);
  if (close) {
    if (await dialog.isVisible()) await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  } else if (!(await dialog.isVisible())) {
    // A successful ink transition reveals the page and closes appearance.
    // Callers requesting mode changes reopen the settings intentionally.
    await openAppearance(page);
  }
}

async function expectUniqueIds(page: Page) {
  const duplicateIds = await page.locator('[id]').evaluateAll(elements => {
    const seen = new Set<string>();
    return elements.map(element => element.id).filter(id => seen.has(id) || !seen.add(id));
  });
  expect(duplicateIds, 'Switching a theme must not duplicate article, heading, or dialog IDs').toEqual([]);
}

test('each selected home mounts one distinct layout with one main and valid article destinations', async ({ page }) => {
  test.setTimeout(90_000);
  await visit(page);
  const initialUrl = page.url();
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  const signatures = {
    koharu: '.k-cover', firefly: '.f-banner', shirone: '.shirone-banner',
    solitude: '.solitude-category-bar', redefine: '.redefine-banner', cactus: '.cactus-intro',
    traveritas: '.traveritas-home', radar: '.radar-home', goodfella: '.goodfella-home',
    ava: '.ava-home', nfinite: '.nfinite-home', followart: '.followart-home',
    milkin: '.milkin-home', digilab: '.digilab-home', stefan: '.stefan-home', buro: '.buro-home',
  };
  const expectedPosts = ['/posts/a-little-space/', '/posts/a-small-tool/', '/posts/between-the-pages/', '/2025/12/18/hello-world/'];
  for (const theme of themes) {
    await selectTheme(page, theme);
    const home = page.locator('#theme-home');
    await expect(home).toHaveAttribute('data-home-theme', theme);
    await expect(home.locator(signatures[theme])).toHaveCount(1);
    for (const other of themes.filter(item => item !== theme)) await expect(home.locator(signatures[other])).toHaveCount(0);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('#main-content')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(home.locator('[data-post-list] .post-card')).toHaveCount(expectedPosts.length);
    for (const path of expectedPosts) await expect(home.locator(`[data-post-list] a[href="${path}"]`).first()).toBeVisible();
    await expectUniqueIds(page);
    expect(page.url()).toBe(initialUrl);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical!);
    if (theme === 'redefine') {
      const banner = (await home.locator('.redefine-banner').boundingBox())!;
      expect(banner.height, 'Redefine has a full-screen landscape, not the shared short hero').toBeGreaterThanOrEqual(900);
      await expect(home.getByRole('link', { name: '向下阅读文章', exact: true })).toHaveAttribute('href', '#writings');
    }
    if (theme === 'cactus') {
      expect((await home.locator('main').boundingBox())!.width).toBeLessThanOrEqual(768);
      await expect(home.getByRole('heading', { name: 'Pinned Posts', exact: true })).toBeVisible();
      await expect(home.getByRole('heading', { name: 'Posts', exact: true })).toBeVisible();
      await expect(home.locator('[data-post-list] img')).toHaveCount(0);
      await expect(home.locator('[data-post-list] time')).toHaveCount(expectedPosts.length);
    }
  }
});

test('all sixteen appearances preserve the article, URL, canonical URL and a single conversation area', async ({ page }) => {
  test.setTimeout(90_000);
  await visit(page, articlePath);
  const originalUrl = page.url();
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  const body = page.locator('#article-body');
  const originalBody = await body.elementHandle();
  const originalText = await body.innerText();

  for (const theme of themes) {
    await selectTheme(page, theme);
    expect(page.url()).toBe(originalUrl);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical!);
    await expect(body).toHaveCount(1);
    expect(await body.innerText()).toBe(originalText);
    expect(await originalBody!.evaluate(node => node.isConnected && node === document.querySelector('#article-body'))).toBe(true);
    await expect(page.locator('.article-conversation')).toHaveCount(1);
    await expect(page.locator('.image-lightbox')).toHaveCount(1);
    await expect(page.locator('#theme-sheet')).toHaveCount(1);
    await expect(page.locator('link[data-pending-theme]')).toHaveCount(0);
    await expectUniqueIds(page);
  }
});

test('the initial page loads one theme and switches only to the chosen theme stylesheet', async ({ page }) => {
  const requested = new Set<string>();
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (/\/themes\/[^/]+\.css$/.test(pathname)) requested.add(pathname);
  });
  await visit(page);
  expect([...requested]).toEqual(['/themes/firefly.css']);
  await selectTheme(page, 'cactus');
  expect([...requested].sort()).toEqual(['/themes/cactus.css', '/themes/firefly.css']);
  await expect(page.locator('link[rel="stylesheet"][href*="/themes/"]')).toHaveCount(1);
});

test('appearance preferences survive reload, navigation and browser back', async ({ page }) => {
  await visit(page);
  await selectTheme(page, 'traveritas');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#theme-sheet')).toHaveAttribute('href', /\/themes\/traveritas\.css$/);
  await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', 'traveritas');
  await page.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '文章', exact: true }).click();
  await expect(page).toHaveURL(/\/archives\/$/);
  await expect(page.locator('#theme-sheet')).toHaveAttribute('href', /\/themes\/traveritas\.css$/);
  await page.goBack({ waitUntil: 'networkidle' });
  await expect(page).toHaveURL(`${testOrigin}/`);
  await expect(page.locator('#theme-sheet')).toHaveAttribute('href', /\/themes\/traveritas\.css$/);
});

test('the expanded appearance selector filters sixteen choices and Traveritas stays interactive after remounting', async ({ page }) => {
  await visit(page, '/?theme=traveritas');
  const reverie = page.getByRole('button', { name: '梦境氛围', exact: true });
  await reverie.click();
  await expect(reverie).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('traveritas-index')).toHaveAttribute('data-reverie', 'true');
  const dialog = await openAppearance(page);
  await expect(dialog.locator('[data-theme-option]:visible')).toHaveCount(16);
  await dialog.locator('[data-theme-filter="journal"]').click();
  await expect(dialog.locator('[data-theme-option]:visible')).toHaveCount(6);
  await expect(dialog.locator('[data-theme-option="traveritas"]')).not.toBeVisible();
  await dialog.locator('[data-theme-filter="gallery"]').click();
  await expect(dialog.locator('[data-theme-option]:visible')).toHaveCount(10);
  await expect(dialog.locator('[data-theme-option="koharu"]')).not.toBeVisible();
  await selectTheme(page, 'buro');
  await selectTheme(page, 'traveritas');
  await expect(reverie).toHaveAttribute('aria-pressed', 'false');
  await reverie.click();
  await expect(reverie).toHaveAttribute('aria-pressed', 'true');
  const refreshed = await openAppearance(page);
  await refreshed.locator('[data-theme-filter="all"]').click();
  await expect(refreshed.locator('[data-theme-option]:visible')).toHaveCount(16);
});

test('light, dark and system modes persist and respond to the operating system', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await visit(page);
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  const dialog = await openAppearance(page);
  await dialog.getByRole('button', { name: '浅色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await openAppearance(page);
  await dialog.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await dialog.getByRole('button', { name: '系统', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.keyboard.press('Escape');
  await visit(page, '/about/');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-mode-preference', 'system');
});

test('themes with category controls filter their own list and cloned controls stay live', async ({ page }) => {
  await visit(page);
  for (const theme of ['koharu', 'firefly', 'shirone', 'solitude'] as const) {
    await selectTheme(page, theme);
    const visibleCards = page.locator('#theme-home [data-post-list] .post-card:visible');
    const all = page.locator('#theme-home [data-category-filter="all"]');
    await all.click();
    const total = await visibleCards.count();
    expect(total).toBeGreaterThan(1);
    for (const [category, title] of [
      ['技术', '把一个想法写成小工具'],
      ['生活', '给日常留一点空白'],
      ['随笔', '写在纸页之间'],
    ]) {
      const filter = page.locator(`#theme-home [data-category-filter="${category}"]`);
      await filter.click();
      await expect(filter).toHaveAttribute('aria-pressed', 'true');
      await expect(visibleCards).toHaveCount(1);
      await expect(visibleCards.getByRole('heading')).toContainText(title);
      await expect(page.locator('#filter-status')).toContainText(`1 篇${category}`);
    }
    await all.click();
    await expect(visibleCards).toHaveCount(total);
  }
  await page.locator('[data-category-filter="技术"]').click();
  await selectTheme(page, 'firefly');
  await expect(page.locator('[data-category-filter="技术"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-post-list] .post-card:visible')).toHaveCount(1);
  await selectTheme(page, 'cactus');
  await expect(page.locator('[data-category-filter]')).toHaveCount(0);
  await expect(page.locator('[data-post-list] .post-card:visible')).toHaveCount(4);
});

test('keyboard search finds Chinese body text, supports selection and opens the result', async ({ page }) => {
  await visit(page);
  const trigger = page.getByRole('button', { name: '搜索文章', exact: true });
  await trigger.focus();
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: '搜索文章', exact: true });
  const input = dialog.getByRole('searchbox');
  await expect(input).toBeFocused();
  await input.fill('原有顺序');
  const result = page.locator('#search-results').getByRole('link');
  await expect(result).toHaveCount(1);
  await expect(result).toContainText('把一个想法写成小工具');
  await expect(result.locator('mark')).toHaveText('原有顺序');
  await page.keyboard.press('ArrowDown');
  await expect(result).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(input).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${articlePath}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('把一个想法写成小工具');
});

test('empty results and potentially malicious strings render only as text', async ({ page }) => {
  const hostileTitle = '恶意<img src=x onerror="window.searchInjected=true">';
  await page.route('**/search-index.json', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ title: hostileTitle, description: '仅作为文本的结果', category: '测试', tags: [], url: articlePath, content: '这里是恶意字符测试。' }]),
  }));
  await visit(page);
  await page.getByRole('button', { name: '搜索文章', exact: true }).click();
  const input = page.getByRole('searchbox');
  await input.fill('恶意');
  await expect(page.locator('#search-results strong')).toHaveText(hostileTitle);
  await expect(page.locator('#search-results img, #search-results script')).toHaveCount(0);
  expect(await page.evaluate(() => 'searchInjected' in window)).toBe(false);
  const missing = '<svg/onload=alert(1)>不存在的关键词';
  await input.fill(missing);
  await expect(page.locator('#search-status')).toHaveText(`没有找到“${missing}”，试试其他关键词。`);
  await expect(page.locator('#search-results a')).toHaveCount(0);
  await expect(page.locator('#search-status svg')).toHaveCount(0);
  await input.fill('');
  await expect(page.locator('#search-status')).toContainText('输入关键词');
});

test('a failed theme download keeps the previous layout and a retry works', async ({ page }) => {
  await visit(page);
  const oldStylesheet = await page.locator('#theme-sheet').elementHandle();
  const oldHome = await page.locator('#main-content').elementHandle();
  await page.route('**/themes/koharu.css', route => route.abort());
  const dialog = await openAppearance(page);
  await dialog.locator('[data-theme-option="koharu"]').click();
  await expect(page.locator('#appearance-status')).toContainText('外观加载失败，当前外观已保留');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'firefly');
  await expect(page.locator('#theme-sheet')).toHaveCount(1);
  expect(await oldStylesheet!.evaluate(node => node.isConnected)).toBe(true);
  expect(await oldHome!.evaluate(node => node.isConnected && node === document.querySelector('#main-content'))).toBe(true);
  await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', 'firefly');
  await expect(page.locator('link[data-pending-theme]')).toHaveCount(0);
  await page.unroute('**/themes/koharu.css');
  await selectTheme(page, 'koharu');
  await expect(page.locator('#main-content')).toBeVisible();
});

test('canceling a pending theme prevents its late response from replacing a newer choice', async ({ page }) => {
  await visit(page);
  let releaseDownload!: () => void;
  const downloadGate = new Promise<void>(resolve => { releaseDownload = resolve; });
  await page.route('**/themes/koharu.css', async route => {
    await downloadGate;
    await route.continue();
  });
  try {
    const dialog = await openAppearance(page);
    const started = page.waitForRequest('**/themes/koharu.css');
    await dialog.locator('[data-theme-option="koharu"]').click();
    await started;
    await expect(dialog).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#theme-transition')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#theme-transition')).toHaveCount(0);
    await expect(dialog).not.toHaveAttribute('aria-busy', 'true');
    await selectTheme(page, 'cactus');
    releaseDownload();
    await expect(page.locator('link[data-pending-theme]')).toHaveCount(0);
    await expect(dialog.locator('[data-theme-option="cactus"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#theme-sheet')).toHaveAttribute('href', /\/themes\/cactus\.css$/);
    await expect(page.locator('#theme-sheet')).toHaveCount(1);
    await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', 'cactus');
    await expect(page.locator('#main-content')).toBeVisible();
  } finally {
    releaseDownload();
  }
});

test('blocked localStorage still permits reading and changing appearance', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage is blocked in this test', 'SecurityError'); },
    });
  });
  await visit(page, articlePath);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('把一个想法写成小工具');
  await selectTheme(page, 'cactus');
  const dialog = await openAppearance(page);
  await dialog.getByRole('button', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('#article-body')).toBeVisible();
  await expect(page.locator('#theme-sheet')).toHaveCount(1);
});

test('switching themes keeps a reachable heading near its reading position', async ({ page }) => {
  test.setTimeout(90_000);
  await visit(page, articlePath);
  await page.evaluate(() => document.fonts.ready);
  // Cactus adds a visible CSS '#' marker to the accessible heading name.
  const heading = page.locator('#article-body').getByRole('heading', { name: /先让核心逻辑独立工作$/ });
  for (const theme of themes) {
    await heading.evaluate(async element => {
      window.scrollTo({ top: window.scrollY + element.getBoundingClientRect().top - 130, behavior: 'instant' });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    });
    const before = (await heading.boundingBox())!.y;
    expect(before, `The starting reading section before choosing ${theme} must be visible`).toBeGreaterThanOrEqual(0);
    expect(before).toBeLessThan(200);
    await selectTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => Math.abs((await heading.boundingBox())!.y - before), {
      message: `${theme} should preserve the same reading section, not merely the same pixel scroll offset`,
    }).toBeLessThanOrEqual(80);
  }
});

test('article link and code copy, table of contents and image enlargement work', async ({ page }) => {
  await visit(page, `${articlePath}?theme=shirone`);
  await page.getByRole('button', { name: '复制文章链接', exact: true }).click();
  await expect(page.locator('#toast')).toHaveText('文章链接已复制');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${testOrigin}${articlePath}`);
  const code = page.locator('#article-body pre').first();
  const expectedCode = await code.locator('code').innerText();
  await code.getByRole('button', { name: '复制代码', exact: true }).click();
  const copiedCode = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiedCode.replace(/\r\n/g, '\n')).toBe(expectedCode.replace(/\r\n/g, '\n'));
  await expect(code.getByRole('button', { name: '复制代码', exact: true })).toHaveText('已复制');

  const toc = page.getByRole('navigation', { name: '文章目录', exact: true });
  const chapter = toc.getByRole('link', { name: '再让界面解释结果', exact: true });
  const fragment = (await chapter.getAttribute('href'))!;
  await chapter.click();
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe(decodeURIComponent(fragment));
  await expect(chapter).toHaveAttribute('aria-current', 'location');
  const target = page.locator('#article-body').getByRole('heading', { name: '再让界面解释结果', exact: true });
  await expect(target).toBeInViewport();

  const zoom = page.getByRole('button', { name: /^放大图片：/ }).first();
  const alt = await zoom.locator('img').getAttribute('alt');
  await zoom.click();
  const lightbox = page.getByRole('dialog', { name: '查看大图', exact: true });
  await expect(lightbox).toBeVisible();
  await expect(lightbox.getByRole('img')).toHaveAttribute('alt', alt!);
  await expect.poll(() => lightbox.getByRole('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(lightbox).not.toBeVisible();
  await expect(zoom).toBeFocused();
  await expect(page.locator('#article-body')).toHaveCount(1);
});

test('legacy articles, archives and every category/tag destination resolve', async ({ page, request }) => {
  const paths = new Set([
    '/2025/12/18/hello-world/', '/2025/12/19/post/',
    '/archives/', '/archives/2025/', '/archives/2025/12/',
    '/categories/', '/tags/', '/about/', '/links/',
  ]);
  for (const path of ['/', '/archives/', '/categories/', '/tags/']) {
    await visit(page, path);
    for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))) {
      const address = new URL(href);
      if (address.origin === testOrigin && /^\/(archives|categories|tags|posts|2025)\//.test(address.pathname)) paths.add(address.pathname);
    }
  }
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), `The linked or preserved address ${path} should exist`).toBe(200);
    expect(response.headers()['content-type']).toContain('text/html');
  }
});

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`${viewport.name} scrolling navigation`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    for (const motion of ['reduce', 'no-preference'] as const) {
      test(`banner navigation stays usable with ${motion} motion`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: motion });
        for (const theme of ['koharu', 'shirone', 'firefly'] as const) {
          await visit(page, `/?theme=${theme}`);
          await page.evaluate(() => document.fonts.ready);
          const header = page.locator('.site-header');
          const appearanceTrigger = header.getByRole('button', { name: '外观', exact: true });
          const banner = page.locator('#theme-home .k-cover, #theme-home .f-banner, #theme-home .shirone-banner');
          const bannerBottom = await banner.evaluate(element => element.getBoundingClientRect().bottom);
          await expect(page.locator('html')).toHaveAttribute('data-nav-scrolled', 'false');
          await page.mouse.move(viewport.width / 2, viewport.height - 40);
          await page.mouse.wheel(0, bannerBottom + 180);
          await expect(page.locator('html')).toHaveAttribute('data-nav-scrolled', 'true');

          if (theme === 'firefly') {
            await expect(page.locator('html')).toHaveAttribute('data-nav-hidden', 'true');
            await expect.poll(async () => {
              const bounds = (await header.boundingBox())!;
              return bounds.y + bounds.height;
            }, { message: 'Firefly should retreat above the viewport on downward reading scroll' }).toBeLessThanOrEqual(0);
            await page.mouse.wheel(0, -110);
            await expect(page.locator('html')).toHaveAttribute('data-nav-hidden', 'false');
          }
          await expect(appearanceTrigger).toBeInViewport();
          await expect(header).toHaveCSS('position', 'fixed');
          if (theme === 'koharu' && viewport.width > 992) {
            expect((await header.boundingBox())!.x).toBeGreaterThanOrEqual(10);
            expect(await header.evaluate(element => parseFloat(getComputedStyle(element).borderTopLeftRadius))).toBeGreaterThan(20);
          }
          if (theme === 'shirone') await expect(header).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
          if (motion === 'reduce') expect(await header.evaluate(element => Math.max(...getComputedStyle(element).transitionDuration.split(',').map(value => parseFloat(value))))).toBeLessThanOrEqual(.001);
          if (viewport.width > 992) await expect(header.getByRole('navigation', { name: '主导航', exact: true }).getByRole('link', { name: '文章', exact: true })).toBeInViewport();
          else await expect(header.getByRole('button', { name: '打开导航', exact: true })).toBeInViewport();

          if (theme === 'firefly') {
            // A reader who is using a toolbar control must not lose that toolbar.
            await appearanceTrigger.focus();
            await page.mouse.wheel(0, 100);
            await expect(appearanceTrigger).toBeInViewport();
            await expect(page.locator('html')).toHaveAttribute('data-nav-hidden', 'false');
            const dialog = await openAppearance(page);
            await page.mouse.wheel(0, 90);
            await expect(dialog).toBeVisible();
            await expect(header).toBeInViewport();
            await page.keyboard.press('Escape');
            await expect(appearanceTrigger).toBeFocused();
            if (viewport.width < 993) {
              await header.getByRole('button', { name: '打开导航', exact: true }).click();
              await expect(page.getByRole('navigation', { name: '手机导航', exact: true })).toBeVisible();
              await page.mouse.move(viewport.width / 2, viewport.height - 40);
              await page.mouse.wheel(0, 100);
              await expect(header).toBeInViewport();
              await expect(page.locator('html')).toHaveAttribute('data-nav-hidden', 'false');
              await page.keyboard.press('Escape');
            }
          }
        }
      });
    }
  });
}

for (const width of [390, 900]) {
  test.describe(`Koharu navigation drawer at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    test('real profile, nested navigation and native modal focus remain usable', async ({ page, request }) => {
      await visit(page, '/?theme=koharu');
      const count = await page.locator('[data-post-list] .post-card').count();
      const trigger = page.locator('.mobile-nav-toggle');
      await expect(trigger).toHaveAttribute('aria-controls', 'koharu-navigation');
      await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      await trigger.click();
      const drawer = page.getByRole('dialog', { name: '小站导航', exact: true });
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveCSS('animation-name', 'none');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(await drawer.evaluate(element => element.matches(':modal'))).toBe(true);
      await expect(page.locator('#mobile-navigation')).not.toBeVisible();
      await expect(drawer.getByRole('img', { name: 'qinghe 的头像', exact: true })).toHaveAttribute('src', /\/media\/avatar\.webp$/);
      await expect.poll(() => drawer.getByRole('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(drawer.locator('.drawer-stats a[href="/archives/"] strong')).toHaveText(String(count));
      const links = drawer.getByRole('navigation', { name: 'Koharu 手机侧栏导航', exact: true });
      for (const [name, href] of [['归档', '/archives/'], ['分类', '/categories/'], ['标签', '/tags/'], ['链接', '/links/'], ['关于', '/about/']]) {
        const link = links.getByRole('link', { name, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', href);
        expect((await request.get(href)).status()).toBe(200);
      }
      await expect(drawer.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute('href', 'https://github.com/XVSHIFU');
      await expect(drawer.getByRole('link', { name: '发送邮件', exact: true })).toHaveAttribute('href', /^mailto:/);
      await expect(drawer.getByRole('link', { name: 'RSS 订阅', exact: true })).toHaveAttribute('href', '/rss.xml');
      const summary = drawer.locator('summary').filter({ hasText: '文章' });
      await summary.click();
      await expect(links.getByRole('link', { name: '归档', exact: true })).not.toBeVisible();
      await summary.click();
      await expect(links.getByRole('link', { name: '归档', exact: true })).toBeVisible();
      const close = drawer.getByRole('button', { name: '关闭小站导航', exact: true });
      const last = drawer.getByRole('link', { name: 'Koharu · 小春日和', exact: true });
      await last.focus();
      await page.keyboard.press('Tab');
      // Chromium permits the browser toolbar between the end and beginning
      // of a native dialog's tab cycle; it must never focus background UI.
      if (!(await page.evaluate(() => document.hasFocus()))) {
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
        await page.keyboard.press('Tab');
      }
      await expect(close).toBeFocused();
      await page.locator('.site-header [data-open-search]').evaluate(element => (element as HTMLElement).focus());
      await expect(close).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      if (!(await page.evaluate(() => document.hasFocus()))) {
        expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
        await page.keyboard.press('Shift+Tab');
      }
      await expect(last).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
      await trigger.click();
      await expect(drawer).toBeVisible();
      await page.mouse.click(width - 8, 400);
      await expect(drawer).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  });
}

test.describe('phone reading', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('all six mobile card layouts keep covers separate from readable article text', async ({ page }) => {
    for (const theme of originalThemes) {
      await visit(page, `/?theme=${theme}`);
      await page.evaluate(() => document.fonts.ready);
      const cards = page.locator('#theme-home [data-post-list] .post-card');
      expect(await cards.count()).toBeGreaterThan(0);
      for (let index = 0; index < await cards.count(); index++) {
        const card = cards.nth(index);
        await expect(card.getByRole('heading')).toBeVisible();
        const cover = card.locator('a:has(> img)').first();
        if (!(await cover.count()) || !(await cover.isVisible())) continue;
        const imageBounds = (await cover.boundingBox())!;
        const textBounds = await card.getByRole('heading').evaluate(heading => {
          const article = heading.closest('article')!;
          let content = heading;
          while (content.parentElement && content.parentElement !== article) content = content.parentElement;
          const rect = content.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        });
        const horizontal = imageBounds.x + imageBounds.width <= textBounds.x + 1 || textBounds.x + textBounds.width <= imageBounds.x + 1;
        const vertical = imageBounds.y + imageBounds.height <= textBounds.y + 1 || textBounds.y + textBounds.height <= imageBounds.y + 1;
        expect(horizontal || vertical,
          `${theme} card ${index + 1}: cover ${JSON.stringify(imageBounds)} must not overlap body ${JSON.stringify(textBounds)}`,
        ).toBe(true);
      }
    }
  });

  test('all sixteen mobile homes fit the viewport and keep shared controls usable', async ({ page }) => {
    test.setTimeout(90_000);
    for (const theme of themes) {
      await visit(page, `/?theme=${theme}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('#theme-home')).toHaveAttribute('data-home-theme', theme);
      await expect(page.locator('main')).toHaveCount(1);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        headings: [...document.querySelectorAll('[data-post-list] .post-card h2, [data-post-list] .post-card h3')].map(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width, textWidth: element.scrollWidth };
        }),
      }));
      expect(dimensions.document, `${theme}: document overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.body, `${theme}: body overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
      for (const heading of dimensions.headings) {
        // A short flex-item title (e.g. Hello World in Milkin) legitimately
        // sizes to its text. Check actual clipping, not an arbitrary box width.
        expect(heading.width, `${theme}: heading must be rendered`).toBeGreaterThan(0);
        expect(heading.textWidth, `${theme}: heading text must fit its box`).toBeLessThanOrEqual(Math.ceil(heading.width) + 1);
        expect(heading.left, `${theme}: heading left edge`).toBeGreaterThanOrEqual(-1);
        expect(heading.right, `${theme}: heading right edge`).toBeLessThanOrEqual(dimensions.viewport + 1);
      }
      const dialog = await openAppearance(page);
      await expect(dialog.locator('[data-theme-option]')).toHaveCount(themes.length);
      const lastChoice = dialog.locator('[data-theme-option="buro"]');
      await lastChoice.scrollIntoViewIfNeeded();
      await expect(lastChoice).toBeInViewport();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('.site-header [data-open-appearance]')).toBeFocused();
      await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
    }
  });

  test('mobile menu and bottom appearance dialog support Escape, focus return and mode choice', async ({ page }) => {
    await visit(page);
    const menu = page.locator('.mobile-nav-toggle');
    await expect(menu).toHaveAccessibleName('打开导航');
    await menu.click();
    const navigation = page.getByRole('navigation', { name: '手机导航', exact: true });
    await expect(navigation).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(navigation).not.toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();

    const trigger = page.locator('.site-header').getByRole('button', { name: '外观', exact: true });
    const dialog = await openAppearance(page);
    const bounds = (await dialog.boundingBox())!;
    expect(Math.abs(bounds.y + bounds.height - 844), 'The mobile sheet can retain a small edge or safe-area gap').toBeLessThanOrEqual(16);
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.width).toBeLessThanOrEqual(391);
    // Sixteen choices are grouped now: initial focus belongs to the active
    // filter at the top, so opening settings does not jump to the old theme.
    await expect(dialog.locator('[data-theme-filter="all"]')).toBeFocused();
    await selectTheme(page, 'cactus', false);
    await dialog.getByRole('button', { name: '深色', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(page.locator('html')).not.toHaveCSS('overflow', 'hidden');
  });

  test('Cactus Chinese home and long article fit the phone while code and tables scroll locally', async ({ page }) => {
    await visit(page, '/?theme=cactus');
    for (const path of ['/?theme=cactus', `${articlePath}?theme=cactus`]) {
      if (new URL(page.url()).pathname !== new URL(path, testOrigin).pathname) await visit(page, path);
      await page.evaluate(() => document.fonts.ready);
      const measurements = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        text: [...document.querySelectorAll('#article-body p, #article-body h2, #article-body h3, .post-card-title')].map(element => {
          const rect = element.getBoundingClientRect();
          return { left: rect.left, right: rect.right };
        }),
      }));
      expect(measurements.document).toBeLessThanOrEqual(measurements.viewport + 1);
      expect(measurements.body).toBeLessThanOrEqual(measurements.viewport + 1);
      for (const bounds of measurements.text) {
        expect(bounds.left).toBeGreaterThanOrEqual(-1);
        expect(bounds.right).toBeLessThanOrEqual(measurements.viewport + 1);
      }
    }
    await expect(page.locator('#article-body pre')).toHaveCSS('overflow-x', 'auto');
    await expect(page.locator('#article-body table')).toHaveCSS('overflow-x', 'auto');
  });
});
