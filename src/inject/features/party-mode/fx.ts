/** 全画面 canvas に描く演出エンジン。演出が無いときは RAF を止める */

const CANVAS_ID = "mr-wplace-party-mode-canvas";
const MAX_PARTICLES = 1500;
const GRAVITY = 0.25;

interface Particle {
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

interface Ring {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatText {
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
const rings: Ring[] = [];
const texts: FloatText[] = [];
let flash = 0;
let flashColor = "255,215,0";
let shake = 0;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let rafId: number | null = null;

const resize = () => {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
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
  rings.length = 0;
  texts.length = 0;
  flash = 0;
  shake = 0;
  window.removeEventListener("resize", resize);
  canvas?.remove();
  canvas = null;
  ctx = null;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const pushParticle = (p: Particle) => {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
};

export const burst = (
  x: number,
  y: number,
  color: string,
  count: number,
  power: number,
) => {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1, 4) * power;
    const maxLife = rand(30, 60);
    pushParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: maxLife,
      maxLife,
      size: rand(2, 5),
      // 1/4 は白い火花
      color: i % 4 === 0 ? "#fff" : color,
      confetti: false,
      rot: 0,
    });
  }
  rings.push({ x, y, life: 20, maxLife: 20, color });
  start();
};

export const confettiRain = (count: number) => {
  const w = window.innerWidth;
  for (let i = 0; i < count; i++) {
    const maxLife = rand(90, 180);
    pushParticle({
      x: rand(0, w),
      y: rand(-200, -10),
      vx: rand(-2, 2),
      vy: rand(1, 5),
      life: maxLife,
      maxLife,
      size: rand(5, 10),
      color: `hsl(${rand(0, 360)},95%,60%)`,
      confetti: true,
      rot: rand(0, Math.PI),
    });
  }
  start();
};

export const floatText = (
  text: string,
  x: number,
  y: number,
  options: { size?: number; rainbow?: boolean; color?: string; life?: number } = {},
) => {
  const maxLife = options.life ?? 50;
  texts.push({
    text,
    x,
    y,
    vy: -1.2,
    life: maxLife,
    maxLife,
    size: options.size ?? 22,
    rainbow: options.rainbow ?? false,
    color: options.color ?? "#fff",
  });
  start();
};

export const centerText = (text: string, size: number, life = 90) =>
  floatText(text, window.innerWidth / 2, window.innerHeight * 0.4, {
    size,
    rainbow: true,
    life,
  });

export const screenFlash = (strength: number, rgb = "255,215,0") => {
  flash = Math.max(flash, strength);
  flashColor = rgb;
  start();
};

export const screenShake = (amount: number) => {
  shake = Math.max(shake, amount);
  start();
};

const drawText = (c: CanvasRenderingContext2D, t: FloatText, now: number) => {
  const progress = 1 - t.life / t.maxLife;
  // 出現時にボヨンと拡大
  const pop = progress < 0.15 ? 0.5 + (progress / 0.15) * 0.7 : 1.2 - Math.min(progress, 0.3);
  const size = t.size * pop;
  c.globalAlpha = Math.min(1, t.life / 15);
  c.font = `900 ${size}px system-ui, sans-serif`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineWidth = Math.max(3, size / 8);
  c.strokeStyle = "#000";
  c.strokeText(t.text, t.x, t.y);
  if (t.rainbow) {
    const w = c.measureText(t.text).width;
    const g = c.createLinearGradient(t.x - w / 2, 0, t.x + w / 2, 0);
    const hue = (now / 4) % 360;
    for (let i = 0; i <= 6; i++) {
      g.addColorStop(i / 6, `hsl(${(hue + i * 60) % 360},100%,60%)`);
    }
    c.fillStyle = g;
  } else {
    c.fillStyle = t.color;
  }
  c.fillText(t.text, t.x, t.y);
};

const tick = (now: number) => {
  rafId = null;
  const c = ctx;
  if (!c) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.clearRect(0, 0, w, h);

  c.save();
  if (shake > 0.5) {
    c.translate(rand(-shake, shake), rand(-shake, shake));
    shake *= 0.88;
  } else shake = 0;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life--;
    if (p.life <= 0 || p.y > h + 50) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += p.confetti ? 0.05 : GRAVITY;
    p.vx *= p.confetti ? 0.99 : 0.97;
    p.x += p.vx + (p.confetti ? Math.sin(now / 200 + p.rot) * 0.8 : 0);
    p.y += p.vy;
    c.globalAlpha = Math.min(1, p.life / (p.maxLife * 0.4));
    c.fillStyle = p.color;
    if (p.confetti) {
      p.rot += 0.1;
      c.save();
      c.translate(p.x, p.y);
      c.rotate(p.rot);
      c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * Math.abs(Math.cos(p.rot * 2)) + 1);
      c.restore();
    } else {
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.life--;
    if (r.life <= 0) {
      rings.splice(i, 1);
      continue;
    }
    const progress = 1 - r.life / r.maxLife;
    c.globalAlpha = 1 - progress;
    c.strokeStyle = r.color;
    c.lineWidth = 4 * (1 - progress) + 1;
    c.beginPath();
    c.arc(r.x, r.y, 6 + progress * 40, 0, Math.PI * 2);
    c.stroke();
  }

  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life--;
    if (t.life <= 0) {
      texts.splice(i, 1);
      continue;
    }
    t.y += t.vy;
    t.vy *= 0.95;
    drawText(c, t, now);
  }
  c.restore();

  if (flash > 0.01) {
    c.globalAlpha = flash;
    c.fillStyle = `rgb(${flashColor})`;
    c.fillRect(0, 0, w, h);
    flash *= 0.9;
  } else flash = 0;
  c.globalAlpha = 1;

  const alive =
    particles.length || rings.length || texts.length || flash || shake;
  if (alive) rafId = requestAnimationFrame(tick);
};

const start = () => {
  ensureCanvas();
  if (rafId === null) rafId = requestAnimationFrame(tick);
};
