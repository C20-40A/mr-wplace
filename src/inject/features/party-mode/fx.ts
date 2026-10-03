/**
 * 全画面 canvas に描く演出エンジン。演出が無いときは RAF を止める
 * - ピクセル由来の粒子/文字は world pixel 座標に固定し、毎フレーム投影し直す (map を動かしてもずれない)
 * - 紙吹雪/上部文字は画面座標
 * mobile 前提で上限を絞る
 */

const CANVAS_ID = "mr-wplace-party-mode-canvas";
const IS_COARSE = window.matchMedia("(pointer: coarse)").matches;
const MAX_PARTICLES = IS_COARSE ? 200 : 500;
const MAX_TEXTS = 16;
const GRAVITY = 0.2;

/** world pixel → 画面座標。毎フレーム 1 回作り直す */
export type WorldToScreen = (wx: number, wy: number) => { x: number; y: number };
type ProjectorFactory = (refWx: number, refWy: number) => WorldToScreen | null;

/** world: 画面座標 = 投影(wx, wy) + (x, y)。screen: x, y がそのまま画面座標 */
interface Anchor {
  world: boolean;
  wx: number;
  wy: number;
}

interface Particle extends Anchor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  confetti: boolean;
  rot: number;
}

interface FloatText extends Anchor {
  text: string;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rainbow: boolean;
  color: string;
}

const particles: Particle[] = [];
const texts: FloatText[] = [];
let flash = 0;
let flashColor = "255,215,0";
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;
let projectorFactory: ProjectorFactory | null = null;

export const setFxProjectorFactory = (factory: ProjectorFactory | null) => {
  projectorFactory = factory;
};

const resize = () => {
  if (!canvas) return;
  // mobile は高 DPR で fill コストが跳ねるので 2 で頭打ち
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
};

const ensureCanvas = () => {
  if (canvas) return;
  canvas = document.createElement("canvas");
  canvas.id = CANVAS_ID;
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483000;";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
};

export const destroyFx = () => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  particles.length = 0;
  texts.length = 0;
  flash = 0;
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const SCREEN: Anchor = { world: false, wx: 0, wy: 0 };

const pushParticle = (p: Particle) => {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
};

/** world pixel (wx, wy) の中心から弾ける */
export const burstAt = (
  wx: number,
  wy: number,
  color: string,
  count: number,
  power: number,
) => {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1.5, 3.5) * power;
    const maxLife = rand(24, 40);
    pushParticle({
      world: true,
      wx,
      wy,
      x: 0,
      y: 0,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: maxLife,
      maxLife,
      size: rand(4, 8),
      color: i % 3 === 0 ? "#fff" : color,
      confetti: false,
      rot: 0,
    });
  }
  start();
};

export const confettiRain = (count: number) => {
  const w = window.innerWidth;
  const n = Math.min(count, MAX_PARTICLES);
  for (let i = 0; i < n; i++) {
    const maxLife = rand(90, 160);
    pushParticle({
      ...SCREEN,
      x: rand(0, w),
      y: rand(-200, -10),
      vx: rand(-1.5, 1.5),
      vy: rand(1, 4),
      life: maxLife,
      maxLife,
      size: rand(5, 9),
      color: `hsl(${rand(0, 360)},95%,60%)`,
      confetti: true,
      rot: rand(0, Math.PI),
    });
  }
  start();
};

type TextOptions = { size?: number; rainbow?: boolean; color?: string; life?: number };

const pushText = (anchor: Anchor, text: string, x: number, y: number, o: TextOptions) => {
  if (texts.length >= MAX_TEXTS) texts.shift();
  const maxLife = o.life ?? 50;
  texts.push({
    ...anchor,
    text,
    x,
    y,
    vy: -1.2,
    life: maxLife,
    maxLife,
    size: o.size ?? 20,
    rainbow: o.rainbow ?? false,
    color: o.color ?? "#fff",
  });
  start();
};

/** world pixel の少し上に浮かぶ文字 */
export const textAt = (wx: number, wy: number, text: string, o: TextOptions = {}) =>
  pushText({ world: true, wx, wy }, text, 0, -22, o);

/** 画面上部の大きい文字（マップ中央を隠さない） */
export const topText = (text: string, size: number, o: TextOptions & { offsetY?: number } = {}) =>
  pushText(
    SCREEN,
    text,
    window.innerWidth / 2,
    Math.max(72, window.innerHeight * 0.14) + (o.offsetY ?? 0),
    { rainbow: true, life: 80, ...o, size },
  );

export const screenFlash = (strength: number, rgb = "255,215,0") => {
  flash = Math.max(flash, strength);
  flashColor = rgb;
  start();
};

const drawText = (c: CanvasRenderingContext2D, t: FloatText, x: number, y: number, now: number) => {
  const progress = 1 - t.life / t.maxLife;
  // 出現時にボヨンと拡大
  const pop = progress < 0.15 ? 0.5 + (progress / 0.15) * 0.6 : 1.1 - Math.min(progress, 0.1);
  const size = t.size * pop;
  c.globalAlpha = Math.min(1, t.life / 15);
  c.font = `900 ${size}px system-ui, sans-serif`;
  c.lineWidth = Math.max(3, size / 7);
  c.strokeText(t.text, x, y);
  c.fillStyle = t.rainbow ? `hsl(${(now / 3) % 360},100%,62%)` : t.color;
  c.fillText(t.text, x, y);
};

/** 毎フレーム、最初の world アンカーを基準に投影関数を作る */
const getFrameProjector = (): WorldToScreen | null => {
  if (!projectorFactory) return null;
  const ref = particles.find((p) => p.world) ?? texts.find((t) => t.world);
  return ref ? projectorFactory(ref.wx, ref.wy) : null;
};

const tick = (now: number) => {
  rafId = null;
  const c = ctx;
  if (!c) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.clearRect(0, 0, w, h);
  const project = getFrameProjector();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    if (--p.life <= 0 || (!p.world && p.y > h + 50)) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.confetti ? 0.04 : GRAVITY;
    p.vx *= p.confetti ? 0.99 : 0.95;
    p.x += p.vx + (p.confetti ? Math.sin(now / 200 + p.rot) * 0.6 : 0);
    p.y += p.vy;
    let { x, y } = p;
    if (p.world) {
      if (!project) continue;
      const o = project(p.wx, p.wy);
      x += o.x;
      y += o.y;
    }
    c.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
    c.fillStyle = p.color;
    if (p.confetti) {
      p.rot += 0.1;
      // 回転の代わりに高さを潰して紙っぽく見せる（save/rotate より安い）
      const hgt = (p.size / 2) * Math.abs(Math.cos(p.rot)) + 1;
      c.fillRect(x - p.size / 2, y - hgt / 2, p.size, hgt);
    } else {
      // 同色の上でも見えるよう黒縁（strokeRect より安い 2 枚重ね）
      const half = p.size / 2;
      c.fillStyle = "#000";
      c.fillRect(x - half - 1.5, y - half - 1.5, p.size + 3, p.size + 3);
      c.fillStyle = p.color;
      c.fillRect(x - half, y - half, p.size, p.size);
    }
  }

  c.textAlign = "center";
  c.textBaseline = "middle";
  c.strokeStyle = "#000";
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    if (--t.life <= 0) {
      texts.splice(i, 1);
      continue;
    }
    t.y += t.vy;
    t.vy *= 0.92;
    let { x, y } = t;
    if (t.world) {
      if (!project) continue;
      const o = project(t.wx, t.wy);
      x += o.x;
      y += o.y;
    }
    drawText(c, t, x, y, now);
  }

  if (flash > 0.01) {
    c.globalAlpha = flash;
    c.fillStyle = `rgb(${flashColor})`;
    c.fillRect(0, 0, w, h);
    flash *= 0.88;
  } else flash = 0;
  c.globalAlpha = 1;

  if (particles.length || texts.length || flash) rafId = requestAnimationFrame(tick);
};

const start = () => {
  ensureCanvas();
  if (rafId === null) rafId = requestAnimationFrame(tick);
};
