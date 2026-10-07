import { themes, url, site } from '../lib/site';
import { beginInkTransition } from './ink-transition';

const root = document.documentElement;
const appearance = document.querySelector<HTMLDialogElement>('#appearance-dialog')!;
const search = document.querySelector<HTMLDialogElement>('#search-dialog')!;
const koharuNavigation = document.querySelector<HTMLDialogElement>('#koharu-navigation')!;
const managedDialogs = [appearance, search, koharuNavigation];
const validThemes: string[] = themes.map(theme => theme.id);
const themeNames = Object.fromEntries(themes.map(theme => [theme.id, theme.name]));
let switchSequence = 0;
let toastTimer: ReturnType<typeof setTimeout>;
let dialogTrigger: HTMLElement | null = null;
let activeThemeTransition: ReturnType<typeof beginInkTransition> | null = null;

function save(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Reading still works when browser storage is unavailable. */ }
}

function notify(message: string) {
  const element = document.querySelector<HTMLElement>('#toast')!;
  clearTimeout(toastTimer);
  element.textContent = message;
  element.hidden = false;
  toastTimer = setTimeout(() => { element.hidden = true; }, 3200);
}

function syncAppearance() {
  const current = root.dataset.theme || 'firefly';
  const navigationToggle = document.querySelector<HTMLElement>('.mobile-nav-toggle');
  navigationToggle?.setAttribute('aria-controls', current === 'koharu' ? 'koharu-navigation' : 'mobile-navigation');
  if (current === 'koharu') navigationToggle?.setAttribute('aria-haspopup', 'dialog');
  else navigationToggle?.removeAttribute('aria-haspopup');
  document.querySelectorAll<HTMLElement>('[data-theme-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeOption === current));
  });
  document.querySelectorAll<HTMLElement>('[data-mode-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.modeOption === (root.dataset.modePreference || 'system')));
  });
  document.querySelectorAll('[data-current-theme]').forEach(element => { element.textContent = themeNames[current]; });
}

function readingAnchor() {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('#article-body h2, #article-body h3, #article-body p, #article-body pre, #article-body table'));
  const visible = nodes.filter(node => node.getBoundingClientRect().bottom > 100 && node.getBoundingClientRect().top < innerHeight);
  const anchor = visible.sort((a, b) => Math.abs(a.getBoundingClientRect().top - 100) - Math.abs(b.getBoundingClientRect().top - 100))[0];
  return anchor ? { element: anchor, top: anchor.getBoundingClientRect().top } : null;
}

function arrangeTheme(theme: string) {
  const home = document.querySelector<HTMLElement>('#theme-home');
  const template = document.querySelector<HTMLTemplateElement>(`template[data-home-template="${theme}"]`);
  if (!home || !template || home.dataset.homeTheme === theme) return;
  const category = home.querySelector<HTMLElement>('[data-category-filter][aria-pressed="true"]')?.dataset.categoryFilter || 'all';
  home.replaceChildren(template.content.cloneNode(true));
  home.dataset.homeTheme = theme;
  filterPosts(category);
}

async function prepareThemeImages(theme: string, signal: AbortSignal) {
  const template = document.querySelector<HTMLTemplateElement>(`template[data-home-template="${theme}"]`);
  if (!template) return;
  const sources = new Set(Array.from(template.content.querySelectorAll<HTMLImageElement>('img:not([loading="lazy"])')).map(image => image.getAttribute('src')!).filter(Boolean));
  template.content.querySelectorAll<HTMLElement>('[data-theme-cover]').forEach(element => { if (element.dataset.themeCover) sources.add(element.dataset.themeCover); });
  // At an existing reading position, prepare the corresponding cover as well.
  if (scrollY > 150) {
    const oldPost = Array.from(document.querySelectorAll<HTMLElement>('#theme-home [data-post-key]')).find(post => post.getBoundingClientRect().bottom > 100);
    const matching = oldPost && template.content.querySelector<HTMLImageElement>(`[data-post-key="${CSS.escape(oldPost.dataset.postKey!)}"] img`);
    if (matching?.getAttribute('src')) sources.add(matching.getAttribute('src')!);
  }
  await Promise.all([...sources].map(source => new Promise<void>((resolve, reject) => {
    const image = new Image();
    const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    const abort = () => { clean(); reject(new DOMException('切换已取消', 'AbortError')); };
    const timer = setTimeout(() => { clean(); reject(new Error('封面加载超时')); }, 12000);
    signal.addEventListener('abort', abort, { once: true });
    image.onload = () => { void image.decode().catch(() => {}).then(() => { clean(); resolve(); }); };
    image.onerror = () => { clean(); reject(new Error('封面加载失败')); };
    image.decoding = 'async';
    image.src = source;
    if (signal.aborted) abort();
  })));
}

async function setTheme(theme: string, persist = true, origin?: { x: number; y: number }) {
  if (!validThemes.includes(theme)) return;
  activeThemeTransition?.dispose();
  activeThemeTransition = null;
  if (root.dataset.theme === theme) {
    // Choosing the current world also cancels any slower, previous request.
    switchSequence++;
    if (persist) save('qinghe-theme', theme);
    appearance.removeAttribute('aria-busy');
    root.style.overflowAnchor = '';
    root.style.scrollBehavior = '';
    if (!managedDialogs.some(dialog => dialog.open)) { root.style.overflow = ''; document.body.style.paddingRight = ''; }
    document.querySelector<HTMLElement>('#appearance-status')!.textContent = `当前外观为 ${themeNames[theme]}`;
    return;
  }
  const request = ++switchSequence;
  const transition = beginInkTransition({ name: themeNames[theme], origin });
  activeThemeTransition = transition;
  let committed = false;
  const status = document.querySelector<HTMLElement>('#appearance-status')!;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url(`themes/${theme}.css`);
  link.media = 'not all';
  link.dataset.pendingTheme = theme;
  status.textContent = `正在加载 ${themeNames[theme]}`;
  appearance.setAttribute('aria-busy', 'true');
  root.style.overflow = 'hidden';
  try {
    const stylesheetReady = new Promise<void>((resolve, reject) => {
      const clean = () => {
        clearTimeout(timer);
        transition.signal.removeEventListener('abort', abort);
        link.onload = null;
        link.onerror = null;
      };
      const abort = () => { clean(); reject(new DOMException('切换已取消', 'AbortError')); };
      const timer = setTimeout(() => { clean(); reject(new Error('加载超时')); }, 12000);
      link.onload = () => { clean(); resolve(); };
      link.onerror = () => { clean(); reject(new Error('资源加载失败')); };
      transition.signal.addEventListener('abort', abort, { once: true });
      document.head.append(link);
    });
    // Network work overlaps the ink entrance. The actual layout swaps only
    // behind a fully opaque frame; no second whole-page screenshot transition.
    const coveredAndPaused = transition.covered.then(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      return new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException('切换已取消', 'AbortError')); };
        const timer = setTimeout(() => { transition.signal.removeEventListener('abort', abort); resolve(); }, 550);
        if (transition.signal.aborted) abort();
        else transition.signal.addEventListener('abort', abort, { once: true });
      });
    });
    await Promise.all([stylesheetReady, prepareThemeImages(theme, transition.signal), coveredAndPaused]);
    if (request !== switchSequence || transition.signal.aborted) { link.remove(); return; }
    const anchor = window.scrollY > 100 ? readingAnchor() : null;
    const oldScroll = window.scrollY;
    const oldPost = Array.from(document.querySelectorAll<HTMLElement>('#theme-home [data-post-key]')).find(post => post.getBoundingClientRect().bottom > 100);
    const postAnchor = oldScroll > 150 && oldPost ? { key: oldPost.dataset.postKey!, top: oldPost.getBoundingClientRect().top } : null;
    const oldLink = document.querySelector<HTMLLinkElement>('#theme-sheet');
    // The browser's own scroll anchoring must not add a second correction
    // while the article switches between columns and different text measures.
    root.style.overflowAnchor = 'none';
    root.style.scrollBehavior = 'auto';
    const restoreReadingPosition = () => {
      if (anchor?.element.isConnected) {
        window.scrollTo({ top: window.scrollY + anchor.element.getBoundingClientRect().top - anchor.top, behavior: 'instant' });
      } else if (oldScroll > 150) {
        const nextPost = postAnchor ? document.querySelector<HTMLElement>(`#theme-home [data-post-key="${CSS.escape(postAnchor.key)}"]`) : null;
        const feed = document.querySelector<HTMLElement>('#main-content');
        if (nextPost && postAnchor) window.scrollTo({ top: window.scrollY + nextPost.getBoundingClientRect().top - postAnchor.top, behavior: 'instant' });
        else if (feed) window.scrollTo({ top: Math.max(0, window.scrollY + feed.getBoundingClientRect().top - 100), behavior: 'instant' });
      }
    };
    transition.commit();
    committed = true;
    appearance.close();
    root.dataset.theme = theme;
    link.id = 'theme-sheet';
    link.media = 'all';
    delete link.dataset.pendingTheme;
    oldLink?.remove();
    arrangeTheme(theme);
    if (persist) save('qinghe-theme', theme);
    syncAppearance();
    // Query overrides are for shareable previews. An explicit choice takes precedence.
    const address = new URL(location.href);
    if (address.searchParams.has('theme')) {
      address.searchParams.delete('theme');
      history.replaceState(history.state, '', address);
    }
    // Let the new grid and text measures settle underneath the opaque ink.
    document.body.getBoundingClientRect();
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 500))]);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    restoreReadingPosition();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    restoreReadingPosition();
    updateHeader(true);
    status.textContent = `已切换为 ${themeNames[theme]}`;
  } catch {
    if (!committed) link.remove();
    if (request === switchSequence) {
      status.textContent = committed ? '外观已切换。' : transition.signal.aborted ? '已取消切换，当前外观已保留。' : '外观加载失败，当前外观已保留。请重试。';
      if (!transition.signal.aborted && !committed) notify('外观加载失败，当前外观已保留。请重试。');
    }
  } finally {
    if (request === switchSequence) {
      await transition.reveal();
      if (request !== switchSequence) return;
      if (activeThemeTransition === transition) activeThemeTransition = null;
      appearance.removeAttribute('aria-busy');
      root.style.overflowAnchor = '';
      root.style.scrollBehavior = '';
      if (!managedDialogs.some(dialog => dialog.open)) {
        root.style.overflow = '';
        document.body.style.paddingRight = '';
        document.querySelector<HTMLElement>('.site-header [data-open-appearance]')?.focus({ preventScroll: true });
      } else appearance.querySelector<HTMLElement>('[aria-pressed="true"][data-theme-option]')?.focus({ preventScroll: true });
    } else {
      transition.dispose();
    }
  }
}

function setMode(mode: string, persist = true) {
  if (!['light', 'dark', 'system'].includes(mode)) return;
  root.dataset.modePreference = mode;
  root.dataset.mode = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  if (persist) save('qinghe-mode', mode);
  syncAppearance();
}

function openDialog(dialog: HTMLDialogElement, trigger?: HTMLElement) {
  if (dialog.open) return;
  managedDialogs.forEach(other => { if (other.open) other.close(); });
  dialogTrigger = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const scrollbarWidth = window.innerWidth - root.clientWidth;
  root.style.overflow = 'hidden';
  document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '';
  dialog.showModal();
  root.dataset.navHidden = 'false';
  if (dialog === koharuNavigation) {
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', '关闭导航');
  }
  if (dialog === appearance) {
    requestAnimationFrame(() => appearance.querySelector<HTMLElement>('[aria-pressed="true"][data-theme-filter]')?.focus({ preventScroll: true }));
  }
}

managedDialogs.forEach(dialog => {
  dialog.addEventListener('close', () => {
    if (dialog === koharuNavigation) {
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.setAttribute('aria-label', '打开导航');
    }
    if (managedDialogs.some(other => other.open) || document.querySelector('#theme-transition[open]')) return;
    root.style.overflow = '';
    document.body.style.paddingRight = '';
    dialogTrigger?.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
});

document.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-open-appearance]');
  if (button) openDialog(appearance, button);
});
document.querySelectorAll<HTMLElement>('[data-theme-option]').forEach(button => button.addEventListener('click', event => {
  const rect = button.getBoundingClientRect();
  const origin = event.detail > 0 ? { x: event.clientX, y: event.clientY } : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  void setTheme(button.dataset.themeOption!, true, origin);
}));
document.querySelectorAll<HTMLElement>('[data-theme-filter]').forEach(button => button.addEventListener('click', () => {
  const group = button.dataset.themeFilter;
  appearance.querySelectorAll<HTMLElement>('[data-theme-filter]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  appearance.querySelectorAll<HTMLElement>('[data-theme-option]').forEach(option => { option.hidden = group !== 'all' && option.dataset.themeGroup !== group; });
}));
document.querySelectorAll<HTMLElement>('[data-mode-option]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.modeOption!)));
document.querySelector('#reset-appearance')?.addEventListener('click', () => { setMode('system'); void setTheme(site.defaultTheme); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (root.dataset.modePreference === 'system') setMode('system', false); });
syncAppearance();
arrangeTheme(root.dataset.theme || 'firefly');

const menuButton = document.querySelector<HTMLButtonElement>('.mobile-nav-toggle')!;
const mobileNav = document.querySelector<HTMLElement>('#mobile-navigation')!;
function closeMenu() { mobileNav.hidden = true; if (koharuNavigation.open) koharuNavigation.close(); menuButton.setAttribute('aria-expanded', 'false'); menuButton.setAttribute('aria-label', '打开导航'); }
menuButton.addEventListener('click', () => {
  if (root.dataset.theme === 'koharu') {
    if (koharuNavigation.open) koharuNavigation.close();
    else openDialog(koharuNavigation, menuButton);
    return;
  }
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  mobileNav.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
});
document.addEventListener('click', event => { if (!(event.target as Element).closest('.site-header, #koharu-navigation')) closeMenu(); });

// Each banner theme keeps its own navigation ritual after the cover leaves view.
let previousHeaderScroll = window.scrollY;
let headerFramePending = false;
function updateHeader(reset = false) {
  const banner = document.querySelector<HTMLElement>('#theme-home .k-cover, #theme-home .f-banner, #theme-home .shirone-banner');
  const y = Math.max(0, window.scrollY);
  const threshold = banner ? Math.max(0, banner.getBoundingClientRect().bottom + y - 72) : Infinity;
  const pastCover = y > threshold;
  root.dataset.navScrolled = String(pastCover);
  const controlsActive = managedDialogs.some(dialog => dialog.open) || !mobileNav.hidden || !!document.activeElement?.closest('.site-header');
  if (reset || root.dataset.theme !== 'firefly' || !pastCover || controlsActive) root.dataset.navHidden = 'false';
  else if (y - previousHeaderScroll > 5) root.dataset.navHidden = 'true';
  else if (y - previousHeaderScroll < -5) root.dataset.navHidden = 'false';
  previousHeaderScroll = y;
  headerFramePending = false;
}
window.addEventListener('scroll', () => {
  if (headerFramePending) return;
  headerFramePending = true;
  requestAnimationFrame(() => updateHeader());
}, { passive: true });
window.addEventListener('resize', () => {
  if (innerWidth > 992 && koharuNavigation.open) koharuNavigation.close();
  updateHeader(true);
});
document.querySelector('.site-header')?.addEventListener('focusin', () => { root.dataset.navHidden = 'false'; });
updateHeader(true);

function filterPosts(requestedCategory: string) {
  const filters = Array.from(document.querySelectorAll<HTMLElement>('[data-category-filter]'));
  const category = filters.some(item => item.dataset.categoryFilter === requestedCategory) ? requestedCategory : 'all';
  filters.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.categoryFilter === category)));
  let count = 0;
  document.querySelectorAll<HTMLElement>('[data-post-list] .post-card, .post-grid > .post-card').forEach(card => {
    card.hidden = category !== 'all' && card.dataset.category !== category;
    if (!card.hidden) count++;
  });
  const status = document.querySelector('#filter-status');
  if (status) status.textContent = `显示 ${count} 篇${category === 'all' ? '' : category}文章`;
}
document.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-category-filter]');
  if (button) filterPosts(button.dataset.categoryFilter || 'all');
});

type SearchEntry = { id?: string; title: string; description: string; category: string; tags: string[]; url: string; content: string };
let entries: SearchEntry[] | null = null;
let searchLoading: Promise<SearchEntry[]> | null = null;
let searchVersion = 0;
const searchInput = document.querySelector<HTMLInputElement>('#search-input')!;
const searchResults = document.querySelector<HTMLUListElement>('#search-results')!;
const searchStatus = document.querySelector<HTMLElement>('#search-status')!;
async function loadSearch() {
  if (entries) return entries;
  if (!searchLoading) searchLoading = fetch(url('search-index.json')).then(response => {
    if (!response.ok) throw new Error('搜索索引加载失败');
    return response.json();
  }).then(data => { entries = Array.isArray(data) ? data : data.posts; return entries!; }).catch(error => { searchLoading = null; throw error; });
  return searchLoading;
}
function highlighted(text: string, query: string) {
  const fragment = document.createDocumentFragment();
  const index = text.toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
  if (index < 0) { fragment.append(document.createTextNode(text)); return fragment; }
  fragment.append(document.createTextNode(text.slice(0, index)));
  const mark = document.createElement('mark'); mark.textContent = text.slice(index, index + query.length); fragment.append(mark);
  fragment.append(document.createTextNode(text.slice(index + query.length)));
  return fragment;
}
async function runSearch() {
  const query = searchInput.value.trim();
  const version = ++searchVersion;
  searchResults.replaceChildren();
  if (!query) { searchStatus.textContent = '输入关键词，找一篇想读的文章。'; return; }
  searchStatus.textContent = '正在查找…';
  try {
    const index = await loadSearch();
    if (version !== searchVersion) return;
    const terms = query.toLocaleLowerCase().split(/\s+/);
    const scored = index.map(entry => {
      const title = entry.title.toLocaleLowerCase();
      const tags = (entry.tags || []).join(' ').toLocaleLowerCase();
      const all = `${title} ${entry.description} ${entry.category} ${tags} ${entry.content}`.toLocaleLowerCase();
      return { entry, score: terms.every(term => all.includes(term)) ? terms.reduce((sum, term) => sum + (title.includes(term) ? 10 : tags.includes(term) ? 4 : 1), 0) : 0 };
    }).filter(item => item.score).sort((a, b) => b.score - a.score);
    searchStatus.textContent = scored.length ? `找到 ${scored.length} 篇文章` : `没有找到“${query}”，试试其他关键词。`;
    for (const { entry } of scored.slice(0, 30)) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = entry.url;
      const title = document.createElement('strong'); title.append(highlighted(entry.title, query));
      const meta = document.createElement('small'); meta.textContent = [entry.category, ...(entry.tags || [])].join(' · ');
      const description = document.createElement('p');
      const contentIndex = entry.content?.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) ?? -1;
      const excerpt = contentIndex >= 0 ? `${contentIndex > 30 ? '…' : ''}${entry.content.slice(Math.max(0, contentIndex - 30), contentIndex + 100)}…` : entry.description;
      description.append(highlighted(excerpt || '', query));
      a.append(meta, title, description); li.append(a); searchResults.append(li);
    }
  } catch {
    if (version === searchVersion) searchStatus.textContent = '搜索暂时加载失败，请检查连接后重新输入。';
  }
}
document.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLElement>('[data-open-search]');
  if (button) { closeMenu(); openDialog(search, button); searchInput.focus({ preventScroll: true }); void loadSearch().catch(() => {}); }
});
let searchTimer: ReturnType<typeof setTimeout>;
searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { void runSearch(); }, 100); });
search.addEventListener('keydown', event => {
  if (event.key === 'Escape') { event.preventDefault(); search.close(); return; }
  const links = Array.from(searchResults.querySelectorAll('a'));
  const current = links.indexOf(document.activeElement as HTMLAnchorElement);
  if (event.key === 'ArrowDown' && links.length) { event.preventDefault(); links[(current + 1) % links.length].focus(); }
  if (event.key === 'ArrowUp' && links.length) { event.preventDefault(); if (current <= 0) searchInput.focus(); else links[current - 1].focus(); }
  if (event.key === 'Enter' && document.activeElement === searchInput && links[0]) { event.preventDefault(); links[0].click(); }
});
document.addEventListener('keydown', event => {
  const target = event.target as HTMLElement;
  if (event.key === 'Escape') closeMenu();
  if ((event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) && !target.matches('input,textarea,[contenteditable="true"]')) {
    event.preventDefault(); openDialog(search); searchInput.focus({ preventScroll: true }); void loadSearch().catch(() => {});
  }
});

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch { return false; }
}
document.querySelectorAll<HTMLElement>('[data-copy-link]').forEach(button => button.addEventListener('click', async () => {
  const link = new URL(location.href); link.searchParams.delete('theme');
  notify(await copyText(link.href) ? '文章链接已复制' : '复制失败，请从地址栏复制链接。');
}));
document.querySelectorAll<HTMLElement>('.prose pre').forEach(pre => {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'code-copy'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码');
  button.addEventListener('click', async () => {
    const ok = await copyText(pre.querySelector('code')?.textContent || '');
    button.textContent = ok ? '已复制' : '重试'; setTimeout(() => { button.textContent = '复制'; }, 1800);
  });
  pre.append(button);
});

const headings = Array.from(document.querySelectorAll<HTMLElement>('#article-body h2[id], #article-body h3[id]'));
if (matchMedia('(max-width: 760px)').matches) document.querySelector('.article-toc-details')?.removeAttribute('open');
const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-toc] a'));
if (headings.length) {
  let ticking = false;
  const updateToc = () => {
    let active = headings[0];
    for (const heading of headings) { if (heading.getBoundingClientRect().top < 150) active = heading; }
    tocLinks.forEach(link => {
      const selected = decodeURIComponent(link.hash.slice(1)) === active.id;
      if (selected) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(updateToc); } }, { passive: true });
  updateToc();
}

const topButton = document.querySelector<HTMLButtonElement>('#back-to-top')!;
window.addEventListener('scroll', () => { topButton.hidden = scrollY < 500; }, { passive: true });
topButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));

// The lightbox moves no article content and closes with the native dialog keyboard behavior.
const images = document.querySelectorAll<HTMLImageElement>('.prose img');
if (images.length) {
  const lightbox = document.createElement('dialog'); lightbox.className = 'image-lightbox'; lightbox.setAttribute('aria-label', '查看大图');
  const image = document.createElement('img'); const caption = document.createElement('p'); const close = document.createElement('button');
  close.type = 'button'; close.className = 'lightbox-close'; close.textContent = '关闭'; close.addEventListener('click', () => lightbox.close());
  lightbox.append(close, image, caption); document.body.append(lightbox);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('close', () => { root.style.overflow = ''; document.body.style.paddingRight = ''; dialogTrigger?.focus({ preventScroll: true }); });
  images.forEach(img => {
    const wrapper = document.createElement('button'); wrapper.className = 'image-zoom'; wrapper.type = 'button'; wrapper.setAttribute('aria-label', `放大图片：${img.alt || '文章配图'}`);
    img.before(wrapper); wrapper.append(img); wrapper.addEventListener('click', () => { image.src = img.currentSrc || img.src; image.alt = img.alt; caption.textContent = img.alt; openDialog(lightbox, wrapper); });
  });
}
