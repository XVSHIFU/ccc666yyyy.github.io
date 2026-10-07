// Independent WebGL implementation informed by the author's technical case study:
// https://tympanus.net/codrops/2025/03/05/case-study-stefan-vitasovic-portfolio-2025/
// The shared 1 × 128 plane, horizontal noise displacement, curved depth and LED
// treatment follow the described mechanisms. Textures are this blog's own covers.
const vertexSource = `
attribute vec2 aPosition;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform float uTime;
uniform float uDisplacement;
uniform float uVelocity;
varying vec2 vUv;
float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float noise(float x) {
  float i = floor(x); float f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), f);
}
void main() {
  vUv = aPosition;
  vec2 local = (aPosition - 0.5) * uRect.zw;
  float wave = noise(aPosition.y * 9.0 + uTime * 0.8) - 0.5;
  float finer = noise(aPosition.y * 31.0 - uTime * 0.45) - 0.5;
  local.x += (wave * 0.28 + finer * 0.055) * uRect.z * uDisplacement;
  local.x += sin(aPosition.y * 3.14159265) * uVelocity * uRect.z * 0.055;
  // Perspective projected bend: the vertical mesh subdivisions allow the image
  // to actually curve, rather than applying a skew to a flat DOM rectangle.
  float depth = sin(aPosition.y * 3.14159265) * uRect.z *
    (0.016 + uDisplacement * 0.12 + abs(uVelocity) * 0.035);
  local *= 900.0 / (900.0 - depth);
  vec2 pixel = uRect.xy + uRect.zw * 0.5 + vec2(local.x, -local.y);
  gl_Position = vec4(pixel.x / uViewport.x * 2.0 - 1.0,
                     1.0 - pixel.y / uViewport.y * 2.0, 0.0, 1.0);
}`;

const fragmentSource = `
precision highp float;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uFromCrop;
uniform vec2 uToCrop;
uniform float uMix;
uniform float uTime;
uniform float uPixelRatio;
varying vec2 vUv;
float random(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 from = texture2D(uFrom, (vUv - 0.5) * uFromCrop + 0.5).rgb;
  vec3 to = texture2D(uTo, (vUv - 0.5) * uToCrop + 0.5).rgb;
  vec3 color = mix(from, to, uMix);
  vec2 pixel = gl_FragCoord.xy / uPixelRatio;
  vec2 cell = fract(pixel / 3.0) - 0.5;
  float led = 1.0 - smoothstep(0.23, 0.48, length(cell));
  float grain = random(floor(pixel) + floor(uTime * 12.0)) - 0.5;
  color = color * (0.955 + led * 0.045) + grain * 0.023;
  gl_FragColor = vec4(color, 1.0);
}`;

type Cover = { image: HTMLImageElement; frame: HTMLElement; texture: WebGLTexture };

export class StefanMediaWebGL {
  private readonly gallery: HTMLElement;
  private readonly controller = new AbortController();
  private readonly eligible = matchMedia('(min-width: 900px) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
  private readonly textures = new Map<HTMLImageElement, WebGLTexture>();
  private canvas?: HTMLCanvasElement;
  private gl?: WebGLRenderingContext;
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private story?: HTMLElement;
  private from?: Cover;
  private current?: Cover;
  private frame = 0;
  private lastDraw = 0;
  private transitionStart = 0;
  private velocity = 0;
  private paused = false;
  private disposed = false;
  private generation = 0;

  constructor(gallery: HTMLElement) {
    this.gallery = gallery;
    const { signal } = this.controller;
    this.eligible.addEventListener('change', () => {
      if (!this.eligible.matches) this.hide();
      else if (this.story) void this.select(this.story);
    }, { signal });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.stop(); else this.wake();
    }, { signal });
    window.addEventListener('pagehide', () => this.stop(), { signal });
    window.addEventListener('pageshow', () => this.wake(), { signal });
  }

  private initialize() {
    if (this.gl) return true;
    if (this.disposed || !this.eligible.matches) return false;
    const canvas = document.createElement('canvas');
    canvas.className = 'stefan-webgl-media';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    this.canvas = canvas; this.gl = gl;
    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error('Shader allocation failed');
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Shader unavailable'); }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      let fragment: WebGLShader | undefined;
      try {
        fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        if (!program) throw new Error('Program allocation failed');
        this.program = program;
        gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Program unavailable');
      } finally { gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); }
      gl.useProgram(this.program!);
      const vertices: number[] = [];
      for (let row = 0; row <= 128; row++) vertices.push(0, row / 128, 1, row / 128);
      this.buffer = gl.createBuffer() || undefined;
      if (!this.buffer) throw new Error('Geometry allocation failed');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program!, 'aPosition');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      for (const name of ['uViewport', 'uRect', 'uTime', 'uDisplacement', 'uVelocity', 'uFrom', 'uTo', 'uFromCrop', 'uToCrop', 'uMix', 'uPixelRatio']) this.uniforms[name] = gl.getUniformLocation(this.program!, name);
      gl.uniform1i(this.uniforms.uFrom, 0); gl.uniform1i(this.uniforms.uTo, 1);
      gl.clearColor(0, 0, 0, 0);
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.destroy(); }, { signal: this.controller.signal });
      this.gallery.prepend(canvas);
      return true;
    } catch { this.destroy(); return false; }
  }

  async select(story: HTMLElement) {
    this.story = story;
    const ticket = ++this.generation;
    if (this.paused || !this.eligible.matches || !this.initialize()) return;
    const image = story.querySelector<HTMLImageElement>('.stefan-cover-frame > img');
    const frame = story.querySelector<HTMLElement>('.stefan-cover-frame');
    if (!image || !frame) { this.hide(); return; }
    try { await image.decode(); } catch { this.hide(); return; }
    if (this.disposed || this.paused || ticket !== this.generation || !this.eligible.matches || !image.naturalWidth) return;
    const gl = this.gl!;
    let texture = this.textures.get(image);
    if (!texture) {
      texture = gl.createTexture() || undefined;
      if (!texture) { this.hide(); return; }
      try {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        this.textures.set(image, texture);
      } catch { gl.deleteTexture(texture); this.hide(); return; }
    }
    const cover = { image, frame, texture };
    this.from = this.current || cover; this.current = cover;
    this.transitionStart = performance.now();
    this.gallery.classList.add('has-stefan-webgl');
    this.canvas!.hidden = false;
    this.wake();
  }

  update(velocity = 0) { this.velocity = Math.max(-1, Math.min(1, velocity / 110)); this.wake(); }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (paused) this.hide(); else if (this.story) void this.select(this.story);
  }

  private wake() {
    if (this.frame || this.disposed || this.paused || !this.eligible.matches || document.hidden || !this.current || !this.canvas || this.canvas.hidden) return;
    this.frame = requestAnimationFrame(time => this.draw(time));
  }

  private draw(time: number) {
    this.frame = 0;
    if (this.disposed || this.paused || !this.eligible.matches || document.hidden || !this.current || !this.from || !this.canvas || !this.gl) return;
    // The source video's surface updates continuously; static blog covers need
    // only a restrained 30 fps material and no frames at all outside the viewport.
    if (time - this.lastDraw < 30) { this.wake(); return; }
    this.lastDraw = time;
    const bounds = this.gallery.getBoundingClientRect();
    const imageBounds = this.current.frame.getBoundingClientRect();
    const gl = this.gl;
    if (!bounds.width || !imageBounds.width || imageBounds.bottom < bounds.top || imageBounds.top > bounds.bottom) {
      gl.clear(gl.COLOR_BUFFER_BIT); return;
    }
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(1_300_000 / (bounds.width * bounds.height)));
    const width = Math.max(1, Math.round(bounds.width * ratio));
    const height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; gl.viewport(0, 0, width, height); }
    const progress = Math.min(1, (time - this.transitionStart) / 1150);
    const mix = progress * progress * (3 - 2 * progress);
    const displacement = Math.sin(progress * Math.PI) * 0.95;
    const crop = (image: HTMLImageElement) => {
      const imageAspect = image.naturalWidth / image.naturalHeight;
      const frameAspect = imageBounds.width / imageBounds.height;
      return imageAspect > frameAspect ? [frameAspect / imageAspect, 1] : [1, imageAspect / frameAspect];
    };
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.uniforms.uViewport, bounds.width, bounds.height);
    gl.uniform4f(this.uniforms.uRect, imageBounds.left - bounds.left, imageBounds.top - bounds.top, imageBounds.width, imageBounds.height);
    gl.uniform1f(this.uniforms.uTime, time / 1000);
    gl.uniform1f(this.uniforms.uDisplacement, displacement);
    gl.uniform1f(this.uniforms.uVelocity, this.velocity);
    gl.uniform1f(this.uniforms.uMix, mix);
    gl.uniform1f(this.uniforms.uPixelRatio, ratio);
    gl.uniform2fv(this.uniforms.uFromCrop, crop(this.from.image));
    gl.uniform2fv(this.uniforms.uToCrop, crop(this.current.image));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.from.texture);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.current.texture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 258);
    this.velocity *= 0.88;
    this.canvas.dataset.displacement = displacement.toFixed(3);
    this.canvas.dataset.progress = progress.toFixed(3);
    this.wake();
  }

  private stop() { cancelAnimationFrame(this.frame); this.frame = 0; }

  private hide() {
    this.stop();
    this.gallery.classList.remove('has-stefan-webgl');
    if (this.canvas) this.canvas.hidden = true;
  }

  destroy() {
    this.disposed = true; this.generation++; this.controller.abort(); this.hide();
    if (this.gl) {
      this.textures.forEach(texture => this.gl!.deleteTexture(texture)); this.textures.clear();
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
      if (this.program) this.gl.deleteProgram(this.program);
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.canvas?.remove(); this.canvas = undefined; this.gl = undefined;
    this.current = undefined; this.from = undefined;
  }
}
