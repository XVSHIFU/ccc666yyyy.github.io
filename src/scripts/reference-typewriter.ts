// Independently written lifecycle-safe typewriter for the three reference themes.
// Mechanism references (no upstream code copied):
// CuteLeaf/Firefly src/components/features/TypewriterText.astro (MIT)
// LyraVoid/Shirone src/components/organisms/BannerStage.astro (MIT)
// evannotfound/hexo-theme-redefine source/js/plugins/typed.js (GPL-3.0)
class ReferenceTypewriter extends HTMLElement {
  private controller?: AbortController;
  private observer?: IntersectionObserver;
  private timer = 0;
  private output?: HTMLElement;
  private texts: string[][] = [];
  private phrase = 0;
  private count = 0;
  private deleting = false;
  private visible = true;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)');

  connectedCallback() {
    this.controller?.abort();
    this.controller = new AbortController();
    const { signal } = this.controller;
    this.output = this.querySelector<HTMLElement>('[data-typed-output]') || undefined;
    if (!this.output) return;
    let values: string[] = [this.dataset.text || ''];
    try {
      const parsed: unknown = JSON.parse(this.dataset.text || '');
      if (Array.isArray(parsed)) values = parsed.filter((text): text is string => typeof text === 'string' && !!text.trim());
    } catch { /* A plain string is also valid. */ }
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
    this.texts = values.filter(Boolean).map(text => Array.from(segmenter.segment(text), part => part.segment));
    if (!this.texts.length) return;
    this.phrase = this.count = 0;
    this.deleting = false;
    this.visible = true;
    const sync = () => {
      clearTimeout(this.timer);
      if (this.reduced.matches) {
        this.output!.textContent = this.dataset.fallback || this.texts[0].join('');
        this.dataset.typing = 'static';
      } else if (this.visible && !document.hidden) {
        this.output!.textContent = this.texts[this.phrase].slice(0, this.count).join('');
        this.dataset.typing = 'active';
        this.schedule(this.duration('start', 450));
      } else this.dataset.typing = 'paused';
    };
    this.observer = new IntersectionObserver(entries => {
      this.visible = entries[0]?.isIntersecting ?? false;
      sync();
    });
    this.observer.observe(this);
    document.addEventListener('visibilitychange', sync, { signal });
    this.reduced.addEventListener('change', sync, { signal });
    sync();
  }

  private duration(name: string, fallback: number) {
    const value = Number(this.dataset[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private schedule(delay: number) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.advance(), delay);
  }

  private advance() {
    if (!this.isConnected || !this.output || !this.visible || document.hidden || this.reduced.matches) return;
    const text = this.texts[this.phrase];
    if (this.deleting) {
      this.count = Math.max(0, this.count - 1);
      this.output.textContent = text.slice(0, this.count).join('');
      if (this.count) this.schedule(this.duration('delete', 50));
      else {
        this.phrase = (this.phrase + 1) % this.texts.length;
        this.deleting = false;
        this.schedule(this.duration('start', 450));
      }
    } else if (this.count < text.length) {
      this.output.textContent = text.slice(0, ++this.count).join('');
      this.schedule(this.duration('speed', 100));
    } else if (this.texts.length > 1 || this.dataset.loop === 'true') {
      this.deleting = true;
      this.schedule(this.duration('pause', 2000));
    } else this.dataset.typing = 'complete';
  }

  disconnectedCallback() {
    clearTimeout(this.timer);
    this.controller?.abort();
    this.observer?.disconnect();
  }
}

if (!customElements.get('reference-typewriter')) customElements.define('reference-typewriter', ReferenceTypewriter);
