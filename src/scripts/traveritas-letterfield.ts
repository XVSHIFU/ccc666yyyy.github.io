// Source study: Traveritas brand.ts / morph.ts / reality.ts.
// Own text and implementation; the original's cadence and continuous settling
// are retained without changing article titles, dates or body text.
export function createLetterfield(reduced: MediaQueryList, signal: AbortSignal) {
  const brand = document.querySelector<HTMLElement>('.brand-name');
  const markup = brand?.innerHTML;
  const oldLabel = brand?.getAttribute('aria-label');
  const word = 'qinghe';
  const letters = Array.from(word, (character, index) => {
    const span = document.createElement('span');
    span.textContent = character;
    span.setAttribute('aria-hidden', 'true');
    span.style.setProperty('--letter', String(index));
    return span;
  });
  brand?.replaceChildren(...letters);
  brand?.setAttribute('aria-label', '清和的小站');
  const pairs = Array.from(document.querySelectorAll<HTMLElement>('[data-tr-wake]'), element => ({
    element,
    wake: element.dataset.trWake!, dream: element.dataset.trDream!,
    oldLabel: element.getAttribute('aria-label'), face: -1,
    text: element.textContent || '', start: 0, duration: 0,
  }));
  pairs.forEach(pair => pair.element.setAttribute('aria-label', pair.wake));
  let initialized = false, nextTurn = performance.now() + 1000, turn = 0;
  let nextWander = performance.now() + 9000 + Math.random() * 5000;
  let lastFrame = 0;
  const glyphs = Array.from('醒梦之间清和日夜空0123456789·—');
  function resolve(pair: typeof pairs[number], face: number, now: number, instant = false) {
    const text = face ? pair.wake : pair.dream;
    pair.face = face; pair.text = text; pair.start = now;
    pair.duration = reduced.matches || instant ? 0 : 660;
    if (!pair.duration) pair.element.textContent = text;
  }
  document.addEventListener('focusin', event => {
    for (const pair of pairs) if (pair.element.contains(event.target as Node)) {
      pair.duration = 0; pair.element.textContent = pair.text;
    }
  }, { signal });
  document.addEventListener('selectionchange', () => {
    if (!getSelection()?.isCollapsed) pairs.forEach(pair => { pair.duration = 0; pair.element.textContent = pair.text; });
  }, { signal });
  return {
    draw(wake: number, now: number, sweep?: { x: number; half: number; to: number; from: number }) {
      const dream = 1 - wake;
      // Cycling freezes as soon as the world begins to wake, while drift shrinks
      // continuously. Six rotations for our six-letter name, then a breath.
      if (!reduced.matches && wake < .02 && now >= nextTurn) {
        turn = (turn + 1) % word.length;
        nextTurn = now + (turn ? 1000 : 3000);
      } else if (wake >= .02) nextTurn = now + 240;
      letters.forEach((letter, index) => {
        const character = word[(index + (wake > .999 ? 0 : turn)) % word.length];
        if (letter.textContent !== character) letter.textContent = character;
        const t = Math.floor(now / 90) * .09;
        const amplitude = reduced.matches ? 0 : dream;
        letter.style.transform = `translate(${(Math.sin(t * .73 + index * 1.7) * 1.8 * amplitude).toFixed(2)}px,${(Math.cos(t * .61 + index * 1.3) * 3.5 * amplitude).toFixed(2)}px) rotate(${(Math.sin(t * .5 + index) * 3 * amplitude).toFixed(2)}deg)`;
      });
      for (const pair of pairs) {
        let face = wake >= .5 ? 1 : 0;
        if (sweep) {
          const box = pair.element.getBoundingClientRect();
          const crossed = sweep.half >= Math.max(14, Math.abs(box.left + box.width / 2 - sweep.x));
          face = crossed ? sweep.to : sweep.from;
        }
        if (face !== pair.face) resolve(pair, face, now, !initialized);
      }
      initialized = true;
      if (!reduced.matches && wake < .02 && !sweep && now >= nextWander) {
        const visible = pairs.filter(pair => {
          const box = pair.element.getBoundingClientRect();
          return box.bottom > 0 && box.top < innerHeight && !pair.element.contains(document.activeElement);
        });
        const pair = visible[Math.floor(Math.random() * visible.length)];
        if (pair && getSelection()?.isCollapsed !== false) { pair.start = now; pair.duration = 1300; }
        nextWander = now + 9000 + Math.random() * 5000;
      }
      if (now - lastFrame < 32) return;
      lastFrame = now;
      for (const pair of pairs) {
        if (!pair.duration) continue;
        const progress = Math.min(1, (now - pair.start) / pair.duration);
        if (progress >= 1 || reduced.matches) { pair.element.textContent = pair.text; pair.duration = 0; continue; }
        const settled = Math.floor((1 - Math.pow(1 - progress, 3)) * pair.text.length);
        pair.element.textContent = Array.from(pair.text, (character, index) =>
          index < settled || /\s|[，。！？、]/u.test(character) || Math.random() > .38
            ? character : glyphs[Math.floor(Math.random() * glyphs.length)],
        ).join('');
      }
    },
    get busy() { return pairs.some(pair => pair.duration > 0); },
    dispose() {
      if (brand && markup !== undefined) {
        brand.innerHTML = markup;
        if (oldLabel === null || oldLabel === undefined) brand.removeAttribute('aria-label'); else brand.setAttribute('aria-label', oldLabel);
      }
      pairs.forEach(pair => {
        pair.element.textContent = pair.wake;
        if (pair.oldLabel === null) pair.element.removeAttribute('aria-label'); else pair.element.setAttribute('aria-label', pair.oldLabel);
      });
    },
  };
}
