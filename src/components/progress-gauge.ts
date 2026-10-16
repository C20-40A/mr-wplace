import { ensureStyle } from "@/utils/style";

const GAUGE_STYLE_ID = "wps-gauge-style";

/** フィルの伸び切りアニメーション時間(ms)。ポン演出のタイミング合わせに使う */
const FILL_DURATION_MS = 900;

/** OSの「視差効果を減らす」設定が有効か */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 進捗ゲージ共通スタイル。
 *
 * テーマ対応: 色を直接指定せず daisyUI のテーマ変数から組み立てるので、
 * light / dark / legacy どのテーマでも破綻しない。
 * - トラック: --color-base-300（テーマの薄いベース色）
 * - フィル:   --color-primary（wplace はどのテーマでも青系）
 *
 * 演出:
 * - ポン: 100% 到達時に弾ける達成演出（.is-popping を付ける）。
 *   ゲージ自体は横方向のフラッシュのみで、縦には広がらない。
 *   {@link createRichGauge} では加えて小さな金のパーティクルが飛ぶ。
 *
 * COMPLETE だけは例外で、テーマに追従させず金色の固定スタイルにしている
 * （達成感を出す「ご褒美」表示のため）。
 */
export const ensureGaugeStyles = (): void => {
  ensureStyle(
    GAUGE_STYLE_ID,
    `
    .wps-gauge {
      position: relative;
      height: 0.5rem;
      border-radius: 9999px;
      background-color: var(--color-base-300, #e5e7eb);
      box-shadow: inset 0 1px 2px color-mix(in oklab, var(--color-base-content, #000) 20%, transparent);
    }
    .wps-gauge-fill {
      position: relative;
      width: 0;
      height: 100%;
      border-radius: 9999px;
      overflow: hidden;
      background-color: var(--color-primary, #3b82f6);
      background-image:
        linear-gradient(180deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 55%),
        linear-gradient(90deg,
          color-mix(in oklab, var(--color-primary, #3b82f6) 78%, var(--color-base-100, #fff)),
          var(--color-primary, #3b82f6));
      box-shadow: 0 0 7px color-mix(in oklab, var(--color-primary, #3b82f6) 45%, transparent);
      transition: width ${FILL_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    /* COMPLETE: テーマに依存させず、金色で統一した「ご褒美」表示。
       金色のロゴになじむよう金トーンでまとめ、艶(つや)のある質感にしている */
    .wps-gauge.is-complete .wps-gauge-fill {
      background-color: #e6bd55;
      background-image: linear-gradient(115deg, rgba(255, 255, 255, 0) 32%, rgba(255, 255, 255, 0.5) 46%, rgba(255, 255, 255, 0) 62%),
        linear-gradient(135deg, #fbeec0 0%, #f6dd97 28%, #eec86a 54%, #f7e2a4 76%, #e6bd55 100%);
      border-top: 1px solid #dfb14e;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -10px 16px -12px rgba(140, 92, 6, 0.55),
        0 1px 2px rgba(120, 80, 0, 0.12);
    }
    /* ポン: 100% 到達時のフラッシュ。縦（上下）には広がらない */
    .wps-gauge.is-popping {
      animation: wps-gauge-pop 0.55s ease-out;
    }
    @keyframes wps-gauge-pop {
      0%   { transform: scaleX(1); filter: brightness(1); }
      28%  { transform: scaleX(1.03); filter: brightness(1.45) saturate(1.2); }
      62%  { transform: scaleX(0.995); filter: brightness(1.1); }
      100% { transform: scaleX(1); filter: brightness(1); }
    }
    .wps-complete {
      background-image:
        /* ロゴ裏のやわらかい光 */
        radial-gradient(ellipse 72% 92% at 50% 32%, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0) 70%),
        /* 上面の艶 */
        linear-gradient(180deg, rgba(255, 255, 255, 0.85) 0%, rgba(255, 255, 255, 0.3) 18%, rgba(255, 255, 255, 0) 48%),
        /* 斜めの光沢 */
        linear-gradient(115deg, rgba(255, 255, 255, 0) 32%, rgba(255, 255, 255, 0.5) 46%, rgba(255, 255, 255, 0) 62%),
        /* 磨いた金の地 */
        linear-gradient(135deg, #fbeec0 0%, #f6dd97 28%, #eec86a 54%, #f7e2a4 76%, #e6bd55 100%);
      border-top: 1px solid #dfb14e;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.9),
        inset 0 -10px 16px -12px rgba(140, 92, 6, 0.55),
        0 1px 2px rgba(120, 80, 0, 0.12);
    }
    .wps-complete-logo {
      width: 84%;
      max-width: 7.5rem;
      height: auto;
      filter: drop-shadow(0 2px 2px rgba(120, 80, 0, 0.4));
    }
    .wps-complete-sub {
      font-size: 0.625rem;
      font-family: ui-monospace, monospace;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8a6220;
    }
    /* ===== リッチゲージ（全体進捗など、ワイドに見せる用） =====
       薄い目盛りのトラック + グラデーションのフィル + フィル内の数値。
       背景全体をゆっくり流れる光で「生きている」感じを出す。 */
    .wps-rgauge {
      position: relative;
      height: 0.8rem;
    }
    /* 背景全体をゆっくり流れる光 */
    .wps-rgauge::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: 3;
      border-radius: 9999px;
      pointer-events: none;
      background: linear-gradient(100deg,
        transparent 0%,
        rgba(255, 255, 255, 0) 38%,
        rgba(255, 255, 255, 0.22) 50%,
        rgba(255, 255, 255, 0) 62%,
        transparent 100%);
      background-size: 230% 100%;
      background-repeat: no-repeat;
      background-position: 130% 0;
      animation: wps-rgauge-drift 6s linear infinite;
    }
    @keyframes wps-rgauge-drift {
      from { background-position: 130% 0; }
      to { background-position: -130% 0; }
    }
    .wps-rgauge-track {
      position: absolute;
      inset: 0;
      border-radius: 9999px;
      background-color: color-mix(in oklab, var(--color-base-300, #e5e7eb) 62%, transparent);
      box-shadow: inset 0 1px 2px color-mix(in oklab, var(--color-base-content, #000) 12%, transparent);
      overflow: hidden;
    }
    /* 目盛り: 薄くて繊細な縦線 */
    .wps-rgauge-track::before {
      content: "";
      position: absolute;
      left: 0.4rem;
      right: 0.4rem;
      top: 24%;
      bottom: 24%;
      background-image: repeating-linear-gradient(90deg,
        color-mix(in oklab, var(--color-base-content, #000) 14%, transparent) 0 1px,
        transparent 1px 8px);
    }
    .wps-rgauge-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      z-index: 2;
      width: 0;
      border-radius: 9999px;
      background-image: linear-gradient(90deg, #22d3ee 0%, #38bdf8 32%, #3b82f6 68%, #2563eb 100%);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.45),
        inset 0 -4px 8px -4px rgba(3, 32, 71, 0.45),
        0 1px 5px color-mix(in oklab, #2563eb 40%, transparent);
      transition: width ${FILL_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    .wps-rgauge-value {
      position: absolute;
      top: 50%;
      right: 0.5rem;
      transform: translateY(-50%);
      font-family: ui-monospace, monospace;
      font-size: 0.6875rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.01em;
      font-variant-numeric: tabular-nums;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
      pointer-events: none;
    }
    .wps-rgauge[data-small="true"] .wps-rgauge-value { display: none; }
    .wps-rgauge.is-complete .wps-rgauge-fill {
      background-color: #e6bd55;
      background-image:
        linear-gradient(115deg, rgba(255, 255, 255, 0) 32%, rgba(255, 255, 255, 0.55) 46%, rgba(255, 255, 255, 0) 62%),
        linear-gradient(135deg, #fbeec0 0%, #f6dd97 28%, #eec86a 54%, #f7e2a4 76%, #e6bd55 100%);
      border-top: 1px solid #dfb14e;
    }
    .wps-rgauge.is-popping { animation: wps-gauge-pop 0.55s ease-out; }
    /* ポンのパーティクル（小さな粒。ゲージ自体は上下に広がらない） */
    .wps-rgauge-particle {
      position: absolute;
      top: 50%;
      z-index: 4;
      border-radius: 9999px;
      pointer-events: none;
      background: radial-gradient(circle at 35% 30%, #fff7d6 0%, #f6dd97 45%, #e6bd55 100%);
      box-shadow: 0 0 5px rgba(246, 221, 151, 0.9);
      will-change: transform, opacity;
    }
    @media (prefers-reduced-motion: reduce) {
      .wps-gauge-fill { transition: none; }
      .wps-rgauge-fill { transition: none; }
      .wps-rgauge::before { animation: none; }
    }
    `,
  );
};

const clampPercent = (value: number): number =>
  Math.max(0, Math.min(100, value));

export interface GaugeOptions {
  /** 0-100 */
  percentage: number;
  /** ルート要素に足すクラス */
  className?: string;
  /** ルート要素の inline style */
  style?: string;
  /** マウント時に 0 から percentage まで伸ばす */
  animate?: boolean;
  /** 100% 到達時にポンと弾けさせる */
  popOnComplete?: boolean;
}

export interface ProgressGauge {
  element: HTMLDivElement;
  fill: HTMLDivElement;
  /** 進捗を更新（既定でアニメーション） */
  setPercentage(percentage: number, animate?: boolean): void;
  /** ポン演出を再生 */
  pop(): void;
}

/**
 * ゲージ要素を生成する。テンプレート文字列で組み立てたい場合は
 * {@link gaugeHtml} を使う（同じクラス構成を返す）。
 */
export const createGauge = (options: GaugeOptions): ProgressGauge => {
  const {
    percentage,
    className = "",
    style = "",
    animate = false,
    popOnComplete = false,
  } = options;

  const element = document.createElement("div");
  element.className = `wps-gauge ${className}`.trim();
  if (style) element.style.cssText = style;

  const fill = document.createElement("div");
  fill.className = "wps-gauge-fill";
  element.appendChild(fill);

  const reduced = prefersReducedMotion();
  const target = clampPercent(percentage);

  const applyComplete = (pct: number): void => {
    element.classList.toggle("is-complete", pct >= 100);
  };

  const setPercentage = (value: number, withAnimation = true): void => {
    const pct = clampPercent(value);
    if (!withAnimation || reduced) {
      fill.style.transition = "none";
      fill.style.width = `${pct}%`;
      void fill.offsetWidth; // リフローで transition を無効化したまま確定
      fill.style.transition = "";
    } else {
      fill.style.width = `${pct}%`;
    }
    applyComplete(pct);
  };

  const pop = (): void => {
    if (reduced) return;
    element.classList.remove("is-popping");
    void element.offsetWidth;
    element.classList.add("is-popping");
    const onEnd = (): void => {
      element.classList.remove("is-popping");
      element.removeEventListener("animationend", onEnd);
    };
    element.addEventListener("animationend", onEnd);
  };

  // 初期状態は 0 から
  fill.style.width = "0%";
  if (animate && !reduced) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPercentage(target, true));
    });
  } else {
    setPercentage(target, false);
  }

  if (popOnComplete && target >= 100) {
    const delay = animate && !reduced ? FILL_DURATION_MS : 0;
    window.setTimeout(pop, delay + 60);
  }

  return { element, fill, setPercentage, pop };
};

/**
 * ゲージの HTML 文字列（テンプレート埋め込み用）。
 * {@link createGauge} と同じクラス構成で、幅だけ確定した状態を返す。
 */
export const gaugeHtml = (options: {
  percentage: number;
  className?: string;
  style?: string;
}): string => {
  const pct = clampPercent(options.percentage);
  const cls = `wps-gauge${options.className ? ` ${options.className}` : ""}`;
  const styleAttr = options.style ? ` style="${options.style}"` : "";
  return `<div class="${cls}"${styleAttr}><div class="wps-gauge-fill" style="width: ${pct}%;"></div></div>`;
};

export interface RichGaugeOptions {
  /** 0-100 */
  percentage: number;
  /** マウント時に 0 から percentage まで伸ばす（数値もカウントアップする） */
  animate?: boolean;
  /** 100% 到達時にポンと弾けさせる */
  popOnComplete?: boolean;
}

export interface RichGauge {
  element: HTMLDivElement;
  fill: HTMLDivElement;
  /** 進捗を更新（既定でアニメーション） */
  setPercentage(percentage: number, animate?: boolean): void;
  /** ポン演出を再生 */
  pop(): void;
}

/**
 * 薄い目盛り + グラデーション + フィル内数値の「リッチ」ゲージ。
 * 背景全体をゆっくり流れる光で動かす。全体進捗のようなワイド表示向け。
 */
export const createRichGauge = (options: RichGaugeOptions): RichGauge => {
  const { percentage, animate = false, popOnComplete = false } = options;

  const element = document.createElement("div");
  element.className = "wps-rgauge";
  element.innerHTML = `
    <div class="wps-rgauge-track"></div>
    <div class="wps-rgauge-fill"><span class="wps-rgauge-value"></span></div>
  `;

  const fill = element.querySelector(".wps-rgauge-fill") as HTMLDivElement;
  const value = element.querySelector(".wps-rgauge-value") as HTMLSpanElement;

  const reduced = prefersReducedMotion();
  const target = clampPercent(percentage);
  let counterRaf = 0;

  const paintLabels = (pct: number): void => {
    value.textContent = `${pct.toFixed(1)}%`;
    element.dataset.small = pct < 18 ? "true" : "false";
  };

  const setPercentage = (p: number, withAnimation = true): void => {
    const pct = clampPercent(p);
    cancelAnimationFrame(counterRaf);
    element.classList.toggle("is-complete", pct >= 100);

    if (!withAnimation || reduced) {
      fill.style.transition = "none";
      fill.style.width = `${pct}%`;
      paintLabels(pct);
      void fill.offsetWidth;
      fill.style.transition = "";
      return;
    }

    // バーは CSS transition、数値は rAF でカウントアップ
    fill.style.width = `${pct}%`;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / FILL_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      paintLabels(pct * eased);
      if (t < 1) counterRaf = requestAnimationFrame(tick);
      else paintLabels(pct);
    };
    counterRaf = requestAnimationFrame(tick);
  };

  const pop = (): void => {
    if (reduced) return;
    element.classList.remove("is-popping");
    void element.offsetWidth;
    element.classList.add("is-popping");
    spawnParticles();
    const onEnd = (): void => {
      element.classList.remove("is-popping");
      element.removeEventListener("animationend", onEnd);
    };
    element.addEventListener("animationend", onEnd);
  };

  /** 100% 到達時、金色のしずくが弾けるパーティクル */
  const spawnParticles = (): void => {
    const count = 16;
    for (let i = 0; i < count; i++) {
      const particle = document.createElement("span");
      particle.className = "wps-rgauge-particle";
      const size = 3 + Math.random() * 3.5;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.left = `${Math.random() * 100}%`;
      element.appendChild(particle);

      // 横〜上方向へ低く扇状に飛ばす（縦に大きく広がらない）
      const spread = 96;
      const angle = (-90 + (Math.random() * spread - spread / 2)) * (Math.PI / 180);
      const dist = 16 + Math.random() * 30;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;

      const anim = particle.animate(
        [
          { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1, offset: 0.15 },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.9)`,
            opacity: 0.9,
            offset: 0.7,
          },
          {
            transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy * 1.2 + 10}px)) scale(0.4)`,
            opacity: 0,
          },
        ],
        {
          duration: 620 + Math.random() * 260,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
      anim.onfinish = () => particle.remove();
    }
  };

  // 初期状態は 0 から
  fill.style.width = "0%";
  paintLabels(0);
  if (animate && !reduced) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setPercentage(target, true));
    });
  } else {
    setPercentage(target, false);
  }

  if (popOnComplete && target >= 100) {
    const delay = animate && !reduced ? FILL_DURATION_MS : 0;
    window.setTimeout(pop, delay + 60);
  }

  return { element, fill, setPercentage, pop };
};
