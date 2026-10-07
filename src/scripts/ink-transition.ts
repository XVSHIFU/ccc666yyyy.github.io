type InkTransitionOptions = {
  name: string;
  origin?: { x: number; y: number };
};

export type InkTransition = {
  covered: Promise<void>;
  signal: AbortSignal;
  commit: () => void;
  reveal: () => Promise<void>;
  dispose: () => void;
};

const COVER_DURATION = 900;
const REVEAL_DURATION = 650;
const MATERIALS = {
  light: {
    ink: '#f0efec',
    text: '#383633',
    border: '#96918a',
    button: '#e5e2dc',
    hover: '#d9d5cf',
    paper: [240, 239, 236],
    pigment: [42, 40, 37],
  },
  dark: {
    ink: '#302f2d',
    text: '#f0efec',
    border: '#96918a',
    button: '#3d3b37',
    hover: '#4c4944',
    paper: [48, 47, 45],
    pigment: [177, 172, 164],
  },
} as const;
let activeTransition: InkTransition | undefined;

function smooth(value: number) {
  const clipped = Math.max(0, Math.min(1, value));
  return clipped * clipped * (3 - 2 * clipped);
}

/**
 * An independently authored procedural ink mask. CodyHouse's Ink Transition
 * and Robin Delaporte's CSS Mask Transition demonstrate the underlying idea:
 * irregular alpha reveals matter more than a colored overlay. Here the mask
 * is generated in bounded memory, without their sprite assets or source code.
 * The caller owns the actual theme swap and covered-state pause.
 */
export function beginInkTransition(options: InkTransitionOptions): InkTransition {
  activeTransition?.dispose();

  const controller = new AbortController();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tone = document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light';
  const material = MATERIALS[tone];
  const dialog = document.createElement('dialog');
  dialog.id = 'theme-transition';
  dialog.dataset.phase = 'covering';
  dialog.dataset.tone = tone;
  // Keep the selected material stable while the underlying theme sheet changes.
  for (const key of ['ink', 'text', 'border', 'button', 'hover'] as const) {
    dialog.style.setProperty(`--ink-transition-${key}`, material[key]);
  }
  dialog.style.colorScheme = tone;
  dialog.setAttribute('aria-labelledby', 'theme-transition-status');
  dialog.setAttribute('aria-modal', 'true');
  dialog.tabIndex = -1;

  const canvas = document.createElement('canvas');
  canvas.className = 'ink-transition-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const veil = document.createElement('div');
  veil.className = 'ink-transition-fallback';
  veil.setAttribute('aria-hidden', 'true');
  const feedback = document.createElement('div');
  feedback.className = 'ink-transition-feedback';
  const status = document.createElement('p');
  status.id = 'theme-transition-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.textContent = `正在切换至 ${options.name}`;
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'ink-transition-cancel';
  cancel.textContent = '取消切换';
  cancel.hidden = true;
  feedback.append(status, cancel);
  dialog.append(canvas, veil, feedback);
  document.body.append(dialog);

  let disposed = false;
  let isCovered = false;
  let committed = false;
  let isRevealing = false;
  let frame = 0;
  let holdTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let width = window.innerWidth;
  let height = window.innerHeight;
  let coverProgress = 0;
  let revealProgress = 0;
  let context: CanvasRenderingContext2D | null = null;
  let fallback = reducedMotion;
  let resolveCovered!: () => void;
  const covered = new Promise<void>(resolve => { resolveCovered = resolve; });
  let revealPromise: Promise<void> | undefined;
  let resolveReveal: (() => void) | undefined;
  let animationStep: ((now: number) => void) | undefined;
  const origin = {
    x: Math.max(0, Math.min(width, options.origin?.x ?? width / 2)),
    y: Math.max(0, Math.min(height, options.origin?.y ?? height / 2)),
  };
  dialog.dataset.originX = String(origin.x);
  dialog.dataset.originY = String(origin.y);
  const fieldCanvas = document.createElement('canvas');
  const fieldContext = fieldCanvas.getContext('2d', { alpha: true });
  let fieldImage: ImageData | undefined;
  let arrivals = new Float32Array(0);
  let exits = new Float32Array(0);
  let fibers = new Float32Array(0);
  const seedX = Math.random() * 100;
  const seedY = Math.random() * 100;
  const noiseGrid = Float32Array.from({ length: 64 * 64 }, () => Math.random());

  // Smooth value noise, sampled only while preparing the compact mask field.
  function noise(x: number, y: number) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = smooth(x - ix);
    const ty = smooth(y - iy);
    const at = (dx: number, dy: number) => noiseGrid[((iy + dy) & 63) * 64 + ((ix + dx) & 63)];
    const top = at(0, 0) * (1 - tx) + at(1, 0) * tx;
    const bottom = at(0, 1) * (1 - tx) + at(1, 1) * tx;
    return top * (1 - ty) + bottom * ty;
  }

  function prepareField() {
    // At most 262,144 low-resolution samples, reused on every frame. The main
    // canvas scales them smoothly; no per-frame noise, SVG blur or large atlas.
    const scale = Math.min(1, 512 / Math.max(width, height));
    fieldCanvas.width = Math.max(1, Math.ceil(width * scale));
    fieldCanvas.height = Math.max(1, Math.ceil(height * scale));
    if (!fieldContext) { useFallback(); return; }
    fieldImage = fieldContext.createImageData(fieldCanvas.width, fieldCanvas.height);
    const count = fieldCanvas.width * fieldCanvas.height;
    arrivals = new Float32Array(count);
    exits = new Float32Array(count);
    fibers = new Float32Array(count);
    const reach = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));
    const size = Math.min(width, height);
    let farthest = 0;
    let lastExit = 0;
    for (let y = 0; y < fieldCanvas.height; y++) {
      for (let x = 0; x < fieldCanvas.width; x++) {
        const index = y * fieldCanvas.width + x;
        const px = (x + .5) / scale;
        const py = (y + .5) / scale;
        const nx = px / size;
        const ny = py / size;
        const warpX = noise(nx * 2 + seedX, ny * 2 + seedY) - .5;
        const warpY = noise(nx * 2 + seedY + 17, ny * 2 + seedX) - .5;
        const broad = noise(nx * 3 + warpX * 1.4 + seedX, ny * 3 + warpY * 1.4 + seedY);
        const middle = noise(nx * 9 + warpX + seedY, ny * 9 + warpY + seedX);
        const fine = noise(nx * 27 + seedX, ny * 27 + seedY);
        const distance = Math.hypot(px - origin.x, py - origin.y) / reach;
        const exitDistance = Math.hypot(px - (width - origin.x), py - (height - origin.y)) / reach;
        const disturbance = (broad - .5) * .24 + (middle - .5) * .075 + (fine - .5) * .009;
        // Broad, warped lobes guide a connected wash. Fine noise only varies
        // the paper absorption; it must not break the outline into hard teeth.
        arrivals[index] = Math.max(0, distance + disturbance * Math.min(1, distance * 5));
        exits[index] = Math.max(0, exitDistance - disturbance * Math.min(1, exitDistance * 5));
        fibers[index] = broad * .65 + middle * .3 + fine * .05;
        farthest = Math.max(farthest, arrivals[index]);
        lastExit = Math.max(lastExit, exits[index]);
      }
    }
    for (let index = 0; index < count; index++) {
      arrivals[index] /= farthest || 1;
      exits[index] /= lastExit || 1;
    }
  }

  function prepareCanvas() {
    if (fallback) return;
    context = canvas.getContext('2d', { alpha: true });
    if (!context) { useFallback(); return; }
    // A large desktop still stays below 2.2 million backing pixels.
    const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(2_200_000 / (width * height)));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    prepareField();
  }

  function useFallback() {
    fallback = true;
    context = null;
    dialog.dataset.motion = 'fade';
    canvas.hidden = true;
    veil.style.opacity = String(isCovered ? 1 : coverProgress);
  }

  function paintField(progress: number, revealing = false) {
    if (!context || !fieldContext || !fieldImage) return;
    const pixels = fieldImage.data;
    const field = revealing ? exits : arrivals;
    // At either endpoint the field is entirely transparent/opaque, so the
    // covered promise remains a real occlusion guarantee rather than a timer.
    const front = Math.pow(progress, revealing ? 1.25 : 1.45) * 1.18 - .09;
    for (let index = 0; index < field.length; index++) {
      const wetness = front - field[index];
      // A wide, translucent wet fringe avoids a cut-out or burnt-paper rim.
      const fringe = .065 + fibers[index] * .02;
      const wetAlpha = smooth((wetness + fringe) / (fringe * 2));
      const alpha = revealing ? 1 - wetAlpha : wetAlpha;
      const offset = index * 4;
      if (alpha <= 0) { pixels[offset + 3] = 0; continue; }
      const fiber = fibers[index];
      // Dilute pigment varies with absorption over a broad area. There is no
      // uniform dark contour: the feathered edge dissolves into the page.
      const diffusion = 1 - smooth(Math.max(0, wetness) / .28);
      const density = .012 + fiber * .019 + diffusion * (.025 + fiber * fiber * .16);
      for (let channel = 0; channel < 3; channel++) {
        pixels[offset + channel] = material.paper[channel]
          + (material.pigment[channel] - material.paper[channel]) * density;
      }
      pixels[offset + 3] = Math.round(alpha * 255);
    }
    fieldContext.putImageData(fieldImage, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.drawImage(fieldCanvas, 0, 0, width, height);
  }

  function drawCover(progress: number) {
    coverProgress = progress;
    if (fallback) { veil.style.opacity = String(progress); return; }
    try {
      paintField(progress);
    } catch { useFallback(); veil.style.opacity = String(progress); }
  }

  function drawReveal(progress: number) {
    revealProgress = progress;
    if (fallback || !isCovered) {
      const opacity = 1 - progress;
      if (fallback) veil.style.opacity = String(coverProgress * opacity);
      else canvas.style.opacity = String(opacity);
      return;
    }
    try {
      paintField(progress, true);
    } catch { useFallback(); veil.style.opacity = String(1 - progress); }
  }

  function requestFrame() {
    if (disposed || document.hidden || frame || !animationStep) return;
    frame = requestAnimationFrame(now => {
      frame = 0;
      animationStep?.(now);
    });
  }

  function animate(duration: number, paint: (progress: number) => void, done: () => void) {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    const started = performance.now();
    animationStep = now => {
      if (disposed) return;
      const progress = Math.min(1, (now - started) / duration);
      paint(progress);
      if (progress >= 1) { animationStep = undefined; done(); }
      else requestFrame();
    };
    requestFrame();
  }

  function finishCover() {
    if (disposed || isRevealing) return;
    isCovered = true;
    dialog.dataset.phase = 'covered';
    // CSS also becomes opaque, so a resize cannot expose a half-swapped page.
    dialog.style.backgroundColor = material.ink;
    resolveCovered();
    holdTimer = setTimeout(() => {
      if (disposed || committed || isRevealing || controller.signal.aborted) return;
      cancel.hidden = false;
    }, 900);
  }

  function requestCancel() {
    if (disposed || committed || isRevealing || controller.signal.aborted) return;
    controller.abort();
    status.textContent = '已取消，正在返回';
    cancel.disabled = true;
  }

  function onCancel(event: Event) { event.preventDefault(); requestCancel(); }
  function onKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); requestCancel(); }
  }
  function onVisibility() {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    } else { requestFrame(); }
  }
  function onResize() {
    width = window.innerWidth;
    height = window.innerHeight;
    try { prepareCanvas(); } catch { useFallback(); }
    if (isRevealing) drawReveal(revealProgress);
    else drawCover(coverProgress);
  }

  function teardown(abort: boolean) {
    if (disposed) return;
    disposed = true;
    if (abort && !controller.signal.aborted) controller.abort();
    if (frame) cancelAnimationFrame(frame);
    animationStep = undefined;
    clearTimeout(holdTimer);
    clearTimeout(watchdog);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', onResize);
    dialog.removeEventListener('cancel', onCancel);
    dialog.removeEventListener('keydown', onKeydown);
    cancel.removeEventListener('click', requestCancel);
    if (dialog.open) dialog.close();
    dialog.remove();
    canvas.width = 1;
    canvas.height = 1;
    fieldCanvas.width = 1;
    fieldCanvas.height = 1;
    context = null;
    fieldImage = undefined;
    arrivals = new Float32Array(0);
    exits = new Float32Array(0);
    fibers = new Float32Array(0);
    resolveCovered();
    resolveReveal?.();
    if (activeTransition === transition) activeTransition = undefined;
  }

  function reveal() {
    if (revealPromise) return revealPromise;
    if (disposed) return Promise.resolve();
    isRevealing = true;
    dialog.dataset.phase = 'revealing';
    dialog.style.backgroundColor = 'transparent';
    clearTimeout(holdTimer);
    clearTimeout(watchdog);
    cancel.hidden = true;
    revealPromise = new Promise<void>(resolve => { resolveReveal = resolve; });
    // Cancellation can arrive mid-cover: fade the ink already on the old page.
    const duration = fallback ? 100 : isCovered ? REVEAL_DURATION : 140;
    animate(duration, drawReveal, () => teardown(false));
    return revealPromise;
  }

  const transition: InkTransition = {
    covered,
    signal: controller.signal,
    commit: () => { committed = true; clearTimeout(holdTimer); cancel.hidden = true; },
    reveal,
    dispose: () => teardown(true),
  };
  activeTransition = transition;
  dialog.addEventListener('cancel', onCancel);
  dialog.addEventListener('keydown', onKeydown);
  cancel.addEventListener('click', requestCancel);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize, { passive: true });
  try { prepareCanvas(); } catch { useFallback(); }
  if (fallback) useFallback();
  try { dialog.showModal(); } catch { dialog.setAttribute('open', ''); }
  dialog.focus({ preventScroll: true });
  drawCover(fallback ? 0 : .008);
  animate(fallback ? 100 : COVER_DURATION, drawCover, finishCover);
  // The resource loader has its own timeout. This final guard cannot strand
  // visitors behind a modal if the caller unexpectedly stops responding.
  watchdog = setTimeout(() => {
    requestCancel();
    if (!disposed && !isRevealing) void reveal();
  }, 15_000);
  return transition;
}
