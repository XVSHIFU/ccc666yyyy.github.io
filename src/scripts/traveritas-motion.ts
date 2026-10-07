// Independently authored from observed interactions of Traveritas /articles/.
// All effects are theme-local; article facts and the shared navigation stay intact.
import { createLetterfield } from './traveritas-letterfield';
const root = document.documentElement;
let teardown: (() => void) | undefined;

function mountTraveritas() {
  const controller = new AbortController();
  const { signal } = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(pointer: fine)');
  const layer = document.createElement('div');
  layer.className = 'tr-motion';
  layer.innerHTML = `<div class="tr-wash" aria-hidden="true"></div><canvas class="tr-field" aria-hidden="true"></canvas><div class="tr-hold-line" aria-hidden="true"><i></i></div><div class="tr-pointer" aria-hidden="true"><i></i><i></i><i></i><svg viewBox="0 0 20 20"><path d="M10 1Q10 10 19 10Q10 10 10 19Q10 10 1 10Q10 10 10 1Z"/></svg></div><nav class="tr-gauge" aria-label="页内导览"><div class="tr-gauge-line"><i></i></div><button type="button" class="tr-gauge-open" aria-expanded="false" aria-controls="tr-gauge-panel">目录</button><div id="tr-gauge-panel" hidden></div></nav><div class="tr-motion-controls"><button type="button" class="tr-native" aria-pressed="false">原生指针</button><button type="button" class="tr-state-toggle" aria-label="切换醒梦状态"><span class="tr-state-label">长按空白 · 唤醒世界</span><small>Shift + Space</small></button></div><p class="sr-only" role="status" data-tr-status></p>`;
  document.body.append(layer);
  const canvas = layer.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d');
  const pointer = layer.querySelector<HTMLElement>('.tr-pointer')!;
  const rings = Array.from(pointer.querySelectorAll<HTMLElement>('i'));
  const thread = layer.querySelector<HTMLElement>('.tr-hold-line')!;
  const label = layer.querySelector<HTMLElement>('.tr-state-label')!;
  const gauge = layer.querySelector<HTMLElement>('.tr-gauge')!;
  const gaugePanel = layer.querySelector<HTMLElement>('#tr-gauge-panel')!;
  const gaugeOpen = layer.querySelector<HTMLButtonElement>('.tr-gauge-open')!;
  const nativeButton = layer.querySelector<HTMLButtonElement>('.tr-native')!;
  const letterfield = createLetterfield(reduced, signal);
  let wake = reduced.matches ? 1 : 0;
  let native = false;
  try { wake = reduced.matches ? 1 : sessionStorage.getItem('qinghe-tr-reality') === 'wake' ? 1 : 0; native = localStorage.getItem('qinghe-tr-native') === 'true'; } catch {}
  let settled: 0 | 1 = wake >= .5 ? 1 : 0;
  let target = wake;
  let width = innerWidth, height = innerHeight, frame = 0, lastPaint = 0, disposed = false;
  let pointerSeen = false, px = width / 2, py = height / 2;
  const ringPositions = rings.map(() => ({ x: px, y: py }));
  let holding = false, holdStart = 0, from = wake, holdX = 0, holdY = 0;
  let movement: { from: number; to: number; start: number; duration: number } | undefined;
  let currentWords = -1;
  let color = '#56606d';
  let travel = 0, previousTick = performance.now();
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('.traveritas-year>h2, #article-body h2, #article-body h3'));
  const sheets = Array.from({ length: 80 }, (_, i) => ({
    cluster: Math.floor(i / 5), column: [0, 1, 2, 0, 1][i % 5], row: i % 5 > 2 ? 1 : 0,
    size: 62 + (Math.floor(i / 5) % 4) * 16,
    scale: 1.2 + Math.pow((i * 37 % 101) / 100, 1.7) * 1.8,
    dx: Math.sin(i * 7.1) * 50, dy: Math.cos(i * 2.7) * 45,
    phase: i * 1.43,
  }));
  const smooth = (p: number) => { const t = Math.max(0, Math.min(1, p)); return t * t * (3 - 2 * t); };
  const wakeWords = () => {
    const next = wake >= .5 ? 1 : 0;
    if (next === currentWords) return;
    currentWords = next;
    root.dataset.trReality = next ? 'wake' : 'dream';
    const world = document.querySelector<HTMLElement>('.traveritas-world');
    if (world) world.dataset.reverie = String(!next);
    document.querySelectorAll('[data-reverie-label]').forEach(element => { element.textContent = next ? '醒' : '梦'; });
    document.querySelector('.traveritas-reverie')?.setAttribute('aria-pressed', String(!next));
    label.textContent = next ? '长按空白 · 重归梦境' : '长按空白 · 唤醒世界';
  };
  function resize() {
    width = innerWidth; height = innerHeight;
    const dpr = Math.min(devicePixelRatio, 1.5, Math.sqrt(2_200_000 / (width * height)));
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    color = getComputedStyle(root).getPropertyValue('--ink').trim();
    paint(performance.now()); request();
  }
  function paint(now: number) {
    if (!ctx) return;
    const dream = 1 - wake, time = now / 1000;
    ctx.clearRect(0, 0, width, height); ctx.fillStyle = color; ctx.strokeStyle = color;
    for (const sheet of sheets) {
      const depth = sheet.cluster % 3;
      const distance = travel * (2400 / [104, 84, 66][depth]);
      const periodX = width + 750, periodY = height + 600;
      const anchorX = ((((sheet.cluster * .618033) % 1) * periodX + distance * .9703) % periodX) - 300;
      const anchorY = ((((sheet.cluster * .414213 + .2) % 1) * periodY + distance * .2419) % periodY) - 210;
      const floatX = holding || movement ? 0 : Math.round(Math.sin(time * .6 + sheet.phase) * 2);
      const floatY = holding || movement ? 0 : Math.round(Math.cos(time * .5 + sheet.phase) * 3);
      const size = sheet.size * (1 + (sheet.scale - 1) * dream);
      const x = anchorX + sheet.column * (sheet.size + 4 + depth * 2) + (sheet.dx - 252 + floatX) * dream - (size - sheet.size) / 2;
      const y = anchorY + sheet.row * (sheet.size + 4 + depth * 2) + (sheet.dy - 63 + floatY) * dream - (size - sheet.size) / 2;
      const centerDistance = Math.abs(x + size / 2 - width / 2) / width;
      const retreat = centerDistance < .30 ? .32 : 1;
      ctx.globalAlpha = .05 * retreat * (.66 + depth * .17);
      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = .09 * retreat * (.66 + depth * .17); ctx.lineWidth = 1;
      ctx.strokeRect(x, y, size, size);
    }
    // Several evolving signals run along the inclined seam, yielding space to text.
    const seamInk = ctx.createLinearGradient(0, 0, width, 0);
    seamInk.addColorStop(0, color); seamInk.addColorStop(.13, color);
    seamInk.addColorStop(.25, 'transparent'); seamInk.addColorStop(.75, 'transparent');
    seamInk.addColorStop(.87, color); seamInk.addColorStop(1, color);
    ctx.strokeStyle = seamInk;
    for (let line = 0; line < 4; line++) {
      ctx.beginPath(); ctx.globalAlpha = .14 - line * .023; ctx.lineWidth = line ? .5 : .8;
      for (let x = -50; x <= width + 50; x += 9) {
        const phase = line % 2 ? Math.floor(time * 4) / 4 : time;
        const raw = Math.sin(x * .015 + phase * .65 + line) * 5 + Math.sin(x * .043 - phase * .3) * 2;
        const wave = line % 2 ? Math.round(raw / 3) * 3 : raw;
        const y = height * .5 + (x - width / 2) * .249 + wave * dream * (line + 1);
        if (x === -50) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function finishState(value: number) {
    settled = value >= .5 ? 1 : 0;
    wake = target = settled; holding = false; movement = undefined;
    thread.style.opacity = '0'; document.body.classList.remove('tr-holding');
    try { sessionStorage.setItem('qinghe-tr-reality', settled ? 'wake' : 'dream'); } catch {}
    layer.querySelector('[data-tr-status]')!.textContent = settled ? '已唤醒，方块拼合并缓慢流动' : '已入梦，方块错开并轻轻浮动';
    wakeWords(); letterfield.draw(wake, performance.now()); paint(performance.now()); request();
  }
  function request() { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(tick); }
  function tick(now: number) {
    frame = 0;
    const elapsedFrame = Math.min(80, now - previousTick); previousTick = now;
    if (!reduced.matches && wake > .999 && !holding && !movement) travel += elapsedFrame / 1000;
    let sweep: { x: number; half: number; to: number; from: number } | undefined;
    if (holding) {
      const elapsed = now - holdStart;
      const duration = target ? 2200 : 1300;
      const progress = smooth(Math.max(0, elapsed - 260) / (duration - 260));
      wake = from + (target - from) * progress;
      thread.style.opacity = elapsed > 260 ? '1' : '0';
      thread.style.setProperty('--thread-length', `${Math.hypot(width, height) * progress * 1.3}px`);
      sweep = { x: holdX, half: Math.hypot(width, height) * progress * .65, to: target, from: settled };
      if (elapsed >= duration) finishState(target);
    } else if (movement) {
      const progress = smooth((now - movement.start) / movement.duration);
      wake = movement.from + (movement.to - movement.from) * progress;
      if (progress >= 1) finishState(movement.to);
    }
    root.style.setProperty('--tr-wake', wake.toFixed(4)); wakeWords();
    letterfield.draw(wake, now, holding ? sweep : undefined);
    let cursorMoving = false;
    if (pointerSeen && !native && !reduced.matches) {
      pointer.style.setProperty('--pointer-x', `${px}px`); pointer.style.setProperty('--pointer-y', `${py}px`);
      rings.forEach((ring, i) => {
        const at = ringPositions[i], ease = .35 - i * .08;
        at.x += (px - at.x) * ease; at.y += (py - at.y) * ease;
        const dx = Math.max(-10, Math.min(10, at.x - px)), dy = Math.max(-10, Math.min(10, at.y - py));
        ring.style.translate = `${dx}px ${dy}px`;
        cursorMoving ||= Math.abs(at.x - px) + Math.abs(at.y - py) > .2;
      });
    }
    if (now - lastPaint > 32 || holding || movement) { paint(now); lastPaint = now; }
    if (!reduced.matches || holding || movement || cursorMoving || letterfield.busy) request();
  }
  function startHold(x: number, y: number) {
    if (holding || document.querySelector('dialog[open]')) return;
    holdX = x; holdY = y;
    target = settled ? 0 : 1; from = wake; movement = undefined;
    if (reduced.matches) { finishState(target); return; }
    holdStart = performance.now(); holding = true;
    thread.style.left = `${x}px`; thread.style.top = `${y}px`;
    document.body.classList.add('tr-holding'); request();
  }
  function releaseHold() {
    if (!holding) return;
    holding = false; thread.style.opacity = '0'; document.body.classList.remove('tr-holding');
    movement = { from: wake, to: settled, start: performance.now(), duration: 420 }; request();
  }
  function toggle() {
    releaseHold(); const next = wake >= .5 ? 0 : 1;
    if (reduced.matches) finishState(next);
    else { movement = { from: wake, to: next, start: performance.now(), duration: 1000 }; request(); }
  }
  function syncPointer() {
    const enabled = fine.matches && !native && !reduced.matches && pointerSeen && !matchMedia('(forced-colors: active)').matches;
    root.classList.toggle('tr-custom-pointer', enabled); pointer.hidden = !enabled;
    nativeButton.setAttribute('aria-pressed', String(native));
  }
  const exclude = 'a,button,input,textarea,select,label,summary,[contenteditable],h1,h2,h3,h4,p,li,time,pre,code,blockquote,dialog';
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || (event.target as Element).closest(exclude)) return;
    startHold(event.clientX, event.clientY);
  }, { signal });
  document.addEventListener('pointermove', event => {
    px = event.clientX; py = event.clientY; pointerSeen = event.pointerType === 'mouse'; syncPointer();
    pointer.classList.toggle('tr-pointer-link', !!(event.target as Element).closest('a,button'));
    if (holding && Math.hypot(px - holdX, py - holdY) > 20) releaseHold();
    request();
  }, { signal, passive: true });
  document.addEventListener('pointerup', releaseHold, { signal });
  document.addEventListener('pointercancel', releaseHold, { signal });
  document.addEventListener('keydown', event => {
    if (event.code === 'Space' && event.shiftKey && !event.repeat && !(event.target as Element).closest('button,a,input,textarea,select,[contenteditable]')) {
      event.preventDefault(); startHold(width / 2, height / 2);
    }
    if (event.key === 'Escape') { releaseHold(); gaugePanel.hidden = true; gaugeOpen.setAttribute('aria-expanded', 'false'); }
  }, { signal });
  document.addEventListener('keyup', event => { if (event.code === 'Space' || event.key === 'Shift') releaseHold(); }, { signal });
  document.addEventListener('click', event => {
    const button = (event.target as Element).closest('.traveritas-reverie, .tr-state-toggle');
    if (button) toggle();
  }, { signal });
  nativeButton.addEventListener('click', () => { native = !native; try { localStorage.setItem('qinghe-tr-native', String(native)); } catch {} syncPointer(); }, { signal });
  document.addEventListener('mouseout', event => { if (!event.relatedTarget) { pointerSeen = false; syncPointer(); } }, { signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; releaseHold(); } else request(); }, { signal });
  window.addEventListener('blur', releaseHold, { signal });
  nodes.forEach(node => { const link = document.createElement('a'); link.href = `#${node.id}`; link.textContent = node.textContent?.trim() || ''; gaugePanel.append(link); });
  gauge.hidden = !nodes.length;
  gaugeOpen.addEventListener('click', () => { gaugePanel.hidden = !gaugePanel.hidden; gaugeOpen.setAttribute('aria-expanded', String(!gaugePanel.hidden)); }, { signal });
  gaugePanel.addEventListener('click', () => { gaugePanel.hidden = true; gaugeOpen.setAttribute('aria-expanded', 'false'); }, { signal });
  const updateGauge = () => {
    const total = document.documentElement.scrollHeight - height;
    gauge.style.setProperty('--read-position', `${total > 0 ? Math.min(1, scrollY / total) * 100 : 0}%`);
    const current = nodes.filter(node => node.getBoundingClientRect().top < height * .4).at(-1) || nodes[0];
    if (current) gaugeOpen.textContent = current.textContent?.trim().slice(0, 15) || '目录';
    paint(performance.now());
  };
  window.addEventListener('scroll', () => { releaseHold(); updateGauge(); }, { signal, passive: true });
  window.addEventListener('resize', resize, { signal, passive: true });
  reduced.addEventListener('change', () => { if (reduced.matches) finishState(1); syncPointer(); request(); }, { signal });
  // A restrained source-like entry uses separate window panes, not the theme ink.
  let seen = true;
  try { seen = sessionStorage.getItem('qinghe-tr-entered') === '1'; sessionStorage.setItem('qinghe-tr-entered', '1'); } catch {}
  let entrance: HTMLElement | undefined;
  if (!seen && !reduced.matches && !document.querySelector('#theme-transition')) {
    entrance = document.createElement('div'); entrance.className = 'tr-entrance'; entrance.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 8; i++) { const pane = document.createElement('i'); pane.style.setProperty('--angle', `${i * 45}deg`); pane.style.setProperty('--delay', `${i * 25}ms`); entrance.append(pane); }
    layer.append(entrance);
    entrance.addEventListener('animationend', () => entrance?.remove(), { once: true, signal });
  }
  syncPointer(); resize(); updateGauge(); wakeWords(); request();
  return () => {
    disposed = true; controller.abort(); cancelAnimationFrame(frame);
    layer.remove(); canvas.width = canvas.height = 1;
    root.classList.remove('tr-custom-pointer'); delete root.dataset.trReality; root.style.removeProperty('--tr-wake');
    document.body.classList.remove('tr-holding');
    letterfield.dispose();
  };
}

function sync() { teardown?.(); teardown = undefined; if (root.dataset.theme === 'traveritas') teardown = mountTraveritas(); }
new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode'] });
sync();
