import { Container, Graphics, Sprite, Text, TextStyle, Texture } from "pixi.js";
import { FONT_STACK } from "../ui/format";
import { hitTextureLoader, spawnHitImage } from "./hit-image";
import {
  gruntRipTextureLoader,
  ripTextureLoader,
  spawnRipImage,
} from "./rip-image";
import type {
  ArtCruiseEffect,
  ArtCruiseEffectContext,
  ArtCruiseEffectSpawner,
} from "./types";

const MAX_EFFECTS = 96;
const BOSS_DEFEAT_SPARK_COUNT = 44;
/** 連続ヒット時の hit エフェクト最小間隔。秒間多発する敵ヒットの間引きに使う */
const HIT_THROTTLE_MS = 80;

type Particle = {
  g: Graphics;
  update: (now: number) => boolean;
};

/**
 * ヒット/撃破エフェクトを常に最前面の独立 layer で描画する。
 * Sprite はプールで再利用し、生成/破棄コストと GC 負荷を抑える。
 * NOTE: テクスチャは spawn 時に同期セットする。非同期 then で後から差し込むと、
 * その間に sprite がプール再利用された場合に別エフェクトのテクスチャを上書きし、
 * hit が rip 見た目になる等の取り違えが起きるため。
 */
export class ArtCruiseEffectManager {
  private readonly layer = new Container();
  private effects: ArtCruiseEffect[] = [];
  private particles: Particle[] = [];
  private readonly spritePool: Sprite[] = [];
  private readonly transientTextures = new WeakSet<Texture>();
  private lastHitSpawnAt = 0;
  /** Physical pixel area of the game viewport. Updated on resize. */
  private viewportArea = 0;

  constructor(private readonly container: Container) {}

  /** Called by game-loop on mount and viewport resize. */
  setViewportArea(area: number) {
    this.viewportArea = area;
  }

  mountLayer() {
    this.container.addChild(this.layer);
    void hitTextureLoader.preload();
    void ripTextureLoader.preload();
    void gruntRipTextureLoader.preload();
  }

  spawnHit(x: number, y: number, now: number, throttle = false) {
    // 秒間多発する敵ヒットは間引く。プレイヤー被弾など重要なものは throttle=false で必ず表示
    if (throttle && now - this.lastHitSpawnAt < HIT_THROTTLE_MS) return;
    this.lastHitSpawnAt = now;
    this.spawn(spawnHitImage, {
      sprite: this.acquireSprite(),
      texture: hitTextureLoader.get() ?? Texture.EMPTY,
      x,
      y,
      now,
    });
  }

  spawnEnemyDeath(x: number, y: number, now: number, isBoss = false) {
    this.spawn(spawnRipImage, {
      sprite: this.acquireSprite(),
      texture:
        (isBoss ? ripTextureLoader : gruntRipTextureLoader).get() ??
        Texture.EMPTY,
      x,
      y,
      now,
      scale: isBoss ? 12 : 4,
    });
    if (isBoss) this.spawnBossDefeatBurst(x, y, now);
  }

  spawnBossEntrance(
    texture: Texture,
    now: number,
    bounds: { width: number; height: number },
    onComplete?: () => void,
  ) {
    // フェーズ: 0→300ms フェードイン / 300→1300ms 保持 / 1300→3500ms フェードアウト
    const lifeMs = 3500;
    const fadeInEnd = 300 / lifeMs;
    const holdEnd = 1300 / lifeMs;

    const sprite = this.acquireSprite();
    this.transientTextures.add(texture);
    sprite.texture = texture;
    sprite.scale.set(3.0);

    const fromX = bounds.width + texture.width * 0.5;
    const toX = bounds.width * 0.78;
    const fixedY = bounds.height * 0.72;
    sprite.y = fixedY;

    // 東方風ボス警告テキスト（2行）
    const titleStyle = new TextStyle({
      fontFamily: FONT_STACK,
      fontSize: 28,
      fontWeight: "bold",
      fontStyle: "italic",
      fill: 0xffe4ff,
      stroke: { color: 0x6600aa, width: 6 },
      dropShadow: { color: 0xff44ff, blur: 18, distance: 0, alpha: 0.9 },
      letterSpacing: 6,
    });
    const subStyle = new TextStyle({
      fontFamily: FONT_STACK,
      fontSize: 14,
      fontStyle: "italic",
      fill: 0xddaaff,
      stroke: { color: 0x330066, width: 4 },
      dropShadow: { color: 0xaa44ff, blur: 10, distance: 0, alpha: 0.8 },
      letterSpacing: 10,
    });

    const titleText = new Text({ text: "― BOSS INCOMING ―", style: titleStyle });
    const subText = new Text({ text: "~ Beware the Divine Brushstroke ~", style: subStyle });
    titleText.anchor.set(0.5);
    subText.anchor.set(0.5);
    titleText.x = bounds.width * 0.5;
    titleText.y = bounds.height * 0.18;
    subText.x = bounds.width * 0.5;
    subText.y = bounds.height * 0.18 + 40;
    this.layer.addChild(titleText, subText);

    let completed = false;
    this.effects.push({
      sprite,
      update: (time) => {
        const t = Math.min((time - now) / lifeMs, 1);
        const ease = 1 - (1 - t) * (1 - t);
        sprite.x = fromX + (toX - fromX) * ease;

        let alpha: number;
        if (t < fadeInEnd) {
          alpha = (t / fadeInEnd) * 0.85;
        } else if (t < holdEnd) {
          alpha = 0.85;
        } else {
          // hold終了後、ease-outで静かにフェードアウト
          const ft = (t - holdEnd) / (1 - holdEnd);
          alpha = 0.85 * (1 - ft * ft);
        }
        sprite.alpha = alpha;

        // テキストはスプライトより遅れてフェードイン、早めにフェードアウト
        const textAlpha =
          t < fadeInEnd
            ? (t / fadeInEnd) * 0.95
            : t < holdEnd
              ? 0.95
              : 0.95 * Math.max(0, 1 - ((t - holdEnd) / (1 - holdEnd)) * 1.4);
        titleText.alpha = textAlpha;
        subText.alpha = textAlpha * 0.85;

        if (t >= 1 && !completed) {
          completed = true;
          this.layer.removeChild(titleText, subText);
          titleText.destroy();
          subText.destroy();
          onComplete?.();
        }
        return t < 1;
      },
    });
  }

  /**
   * ゲーム開始演出。"READY?" がふわっと現れ、"GO!" がパンチインして
   * リングが弾けるアーケード王道の入りで、プレイ開始の合図を出す。
   */
  spawnGameStart(
    now: number,
    bounds: { width: number; height: number },
    onGo?: () => void,
  ) {
    const cx = bounds.width * 0.5;
    const cy = bounds.height * 0.42;

    const readyStyle = new TextStyle({
      fontFamily: FONT_STACK,
      fontSize: 40,
      fontWeight: "bold",
      fontStyle: "italic",
      fill: 0xeaf6ff,
      stroke: { color: 0x004a6e, width: 7 },
      dropShadow: { color: 0x44d6ff, blur: 20, distance: 0, alpha: 0.9 },
      letterSpacing: 8,
    });
    const readyText = new Text({ text: "READY?", style: readyStyle });
    readyText.anchor.set(0.5);
    readyText.position.set(cx, cy);
    this.layer.addChild(readyText);

    // READY?: 0→900ms 表示してフェードアウト。終了時に GO! を出す。
    const readyLifeMs = 900;
    const readyDummy = new Graphics();
    this.layer.addChild(readyDummy);
    let readyDone = false;
    this.particles.push({
      g: readyDummy,
      update: (time) => {
        const t = Math.min((time - now) / readyLifeMs, 1);
        const pop = t < 0.25 ? 1 - (1 - t / 0.25) * (1 - t / 0.25) : 1;
        readyText.scale.set(0.7 + pop * 0.3);
        readyText.alpha = t < 0.7 ? Math.min(1, t / 0.2) : Math.max(0, 1 - (t - 0.7) / 0.3);
        if (t >= 1 && !readyDone) {
          readyDone = true;
          this.layer.removeChild(readyText);
          readyText.destroy();
          this.spawnGoBurst(cx, cy, time);
          onGo?.();
        }
        return t < 1;
      },
    });
  }

  private spawnGoBurst(cx: number, cy: number, now: number) {
    const goText = new Text({
      text: "GO!",
      style: new TextStyle({
        fontFamily: FONT_STACK,
        fontSize: 96,
        fontWeight: "bold",
        fontStyle: "italic",
        fill: 0xfff4cc,
        stroke: { color: 0xaa3300, width: 10 },
        dropShadow: { color: 0xffaa33, blur: 28, distance: 0, alpha: 0.95 },
        letterSpacing: 10,
      }),
    });
    goText.anchor.set(0.5);
    goText.position.set(cx, cy);
    this.layer.addChild(goText);

    // 拡散リング
    const ring = new Graphics();
    ring.position.set(cx, cy);
    this.layer.addChild(ring);

    const lifeMs = 700;
    this.particles.push({
      g: ring,
      update: (time) => {
        const t = Math.min((time - now) / lifeMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        // パンチイン: 大→等倍へ、最後にフェードアウト
        const punch = t < 0.18 ? 1.6 - (1.6 - 1) * (t / 0.18) : 1;
        goText.scale.set(punch);
        goText.alpha = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.4);

        ring.clear();
        ring.circle(0, 0, 30 + eased * 260);
        ring.stroke({ width: 9, color: 0xfff2a8, alpha: (1 - t) * 0.85 });
        ring.circle(0, 0, 14 + eased * 150);
        ring.stroke({ width: 5, color: 0xffffff, alpha: (1 - t) * 0.9 });

        if (t >= 1) {
          this.layer.removeChild(goText);
          goText.destroy();
        }
        return t < 1;
      },
    });
  }

  spawnPlayerDeath(x: number, y: number, now: number) {
    const rings: {
      delayMs: number;
      lifeMs: number;
      maxRadius: number;
      color: number;
    }[] = [
      { delayMs: 0, lifeMs: 600, maxRadius: 80, color: 0xffffff },
      { delayMs: 100, lifeMs: 700, maxRadius: 130, color: 0xff4466 },
      { delayMs: 220, lifeMs: 600, maxRadius: 100, color: 0xffffff },
    ];

    for (const ring of rings) {
      const startAt = now + ring.delayMs;
      const g = new Graphics();
      g.position.set(x, y);
      this.layer.addChild(g);

      this.particles.push({
        g,
        update: (time) => {
          if (time < startAt) return true;
          const t = Math.min((time - startAt) / ring.lifeMs, 1);
          const eased = 1 - (1 - t) * (1 - t);
          g.clear();
          g.circle(0, 0, eased * ring.maxRadius);
          g.stroke({ width: 6, color: ring.color, alpha: 1 - t });
          return t < 1;
        },
      });
    }
  }

  spawnBulletClearRings(
    points: { x: number; y: number; radius: number }[],
    now: number,
  ) {
    if (points.length === 0) return;

    const lifeMs = 360;
    const g = new Graphics();
    this.layer.addChild(g);
    this.particles.push({
      g,
      update: (time) => {
        const t = Math.min((time - now) / lifeMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        g.clear();
        for (const point of points) {
          g.circle(point.x, point.y, point.radius + eased * 18);
          g.stroke({ width: 2, color: 0x9ee8ff, alpha: (1 - t) * 0.75 });
        }
        return t < 1;
      },
    });
  }

  spawnBossPhaseTransitionWithName(
    x: number,
    y: number,
    now: number,
    bounds: { width: number; height: number },
    phaseName: string,
  ) {
    // グラフィックエフェクト（ボス出現と同系統のリング）
    const lifeMs = 760;
    const g = new Graphics();
    g.position.set(x, y);
    this.layer.addChild(g);
    this.particles.push({
      g,
      update: (time) => {
        const t = Math.min((time - now) / lifeMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        g.clear();
        g.circle(0, 0, 34 + eased * 220);
        g.stroke({ width: 10, color: 0xff44ff, alpha: (1 - t) * 0.85 });
        g.circle(0, 0, 18 + eased * 120);
        g.stroke({ width: 5, color: 0xffffff, alpha: (1 - t) * 0.9 });
        g.circle(0, 0, 8 + eased * 60);
        g.stroke({ width: 3, color: 0xff88ff, alpha: (1 - t) * 0.7 });
        return t < 1;
      },
    });

    // 必殺技名テキスト（東方風）
    const nameStyle = new TextStyle({
      fontFamily: FONT_STACK,
      fontSize: 22,
      fontWeight: "bold",
      fontStyle: "italic",
      fill: 0xffe4ff,
      stroke: { color: 0x6600aa, width: 5 },
      dropShadow: { color: 0xff44ff, blur: 16, distance: 0, alpha: 0.9 },
      letterSpacing: 4,
    });
    const labelStyle = new TextStyle({
      fontFamily: FONT_STACK,
      fontSize: 11,
      fontStyle: "italic",
      fill: 0xddaaff,
      stroke: { color: 0x330066, width: 3 },
      dropShadow: { color: 0xaa44ff, blur: 8, distance: 0, alpha: 0.8 },
      letterSpacing: 8,
    });

    const nameText = new Text({ text: `― ${phaseName} ―`, style: nameStyle });
    const labelText = new Text({ text: "~ Special Attack ~", style: labelStyle });
    nameText.anchor.set(0.5);
    labelText.anchor.set(0.5);
    nameText.x = bounds.width * 0.5;
    nameText.y = bounds.height * 0.22;
    labelText.x = bounds.width * 0.5;
    labelText.y = bounds.height * 0.22 + 34;
    this.layer.addChild(nameText, labelText);

    const textLifeMs = 2400;
    const fadeInEnd = 200 / textLifeMs;
    const holdEnd = 1400 / textLifeMs;
    const dummyG = new Graphics();
    this.layer.addChild(dummyG);
    let textDone = false;
    this.particles.push({
      g: dummyG,
      update: (time) => {
        const t = Math.min((time - now) / textLifeMs, 1);
        let alpha: number;
        if (t < fadeInEnd) {
          alpha = (t / fadeInEnd) * 0.95;
        } else if (t < holdEnd) {
          alpha = 0.95;
        } else {
          const ft = (t - holdEnd) / (1 - holdEnd);
          alpha = 0.95 * (1 - ft * ft);
        }
        nameText.alpha = alpha;
        labelText.alpha = alpha * 0.8;

        if (t >= 1 && !textDone) {
          textDone = true;
          this.layer.removeChild(nameText, labelText);
          nameText.destroy();
          labelText.destroy();
        }
        return t < 1;
      },
    });
  }

  spawnBossPhaseChange(x: number, y: number, now: number) {
    const lifeMs = 760;
    const g = new Graphics();
    g.position.set(x, y);
    this.layer.addChild(g);
    this.particles.push({
      g,
      update: (time) => {
        const t = Math.min((time - now) / lifeMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        g.clear();
        g.circle(0, 0, 34 + eased * 170);
        g.stroke({ width: 8, color: 0xffffff, alpha: (1 - t) * 0.85 });
        g.circle(0, 0, 18 + eased * 92);
        g.stroke({ width: 4, color: 0xff7ad9, alpha: (1 - t) * 0.9 });
        return t < 1;
      },
    });
  }

  private spawnBossDefeatBurst(x: number, y: number, now: number) {
    const lifeMs = 980;
    const g = new Graphics();
    g.position.set(x, y);
    this.layer.addChild(g);

    // Scale spark count with physical pixel area of the viewport.
    // Reference area: 390×520px (~200k px²) → full count.
    // Smaller viewports (mobile, narrow window) get proportionally fewer sparks.
    const areaRatio = this.viewportArea > 0
      ? Math.min(1, this.viewportArea / 200_000)
      : 1;
    const sparkCount = Math.max(12, Math.round(BOSS_DEFEAT_SPARK_COUNT * areaRatio));
    const sparks = Array.from({ length: sparkCount }, (_, i) => {
      const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.28;
      const speed = 150 + Math.random() * 260;
      return {
        angle,
        speed,
        size: 2 + Math.random() * 4,
        spin: (Math.random() - 0.5) * 1.4,
        color: Math.random() < 0.35 ? 0xffffff : Math.random() < 0.65 ? 0xffd15c : 0xff66e8,
      };
    });

    this.particles.push({
      g,
      update: (time) => {
        const t = Math.min((time - now) / lifeMs, 1);
        const eased = 1 - (1 - t) * (1 - t);
        const alpha = 1 - t;

        g.clear();
        g.circle(0, 0, 26 + eased * 280);
        g.stroke({ width: 9 * alpha, color: 0xfff2a8, alpha: alpha * 0.75 });
        g.circle(0, 0, 12 + eased * 170);
        g.stroke({ width: 5 * alpha, color: 0xffffff, alpha: alpha * 0.9 });

        for (const spark of sparks) {
          const distance = spark.speed * eased;
          const driftY = 60 * t * t;
          const px = Math.cos(spark.angle) * distance;
          const py = Math.sin(spark.angle) * distance + driftY;
          const tail = spark.size * (2.5 + t * 2);
          const tailAngle = spark.angle + Math.PI + spark.spin * t;
          g.moveTo(px, py);
          g.lineTo(px + Math.cos(tailAngle) * tail, py + Math.sin(tailAngle) * tail);
          g.stroke({ width: spark.size * alpha, color: spark.color, alpha: alpha * 0.95 });
        }

        return t < 1;
      },
    });
  }

  update(now: number, deltaSeconds: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      if (effect.update(now, deltaSeconds)) continue;
      this.releaseSprite(effect.sprite);
      const last = this.effects.pop();
      if (last && i < this.effects.length) this.effects[i] = last;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.update(now)) continue;
      this.layer.removeChild(p.g);
      p.g.destroy();
      const last = this.particles.pop();
      if (last && i < this.particles.length) this.particles[i] = last;
    }
  }

  reset() {
    this.lastHitSpawnAt = 0;
    for (const effect of this.effects) this.releaseSprite(effect.sprite);
    this.effects = [];
    for (const p of this.particles) {
      this.layer.removeChild(p.g);
      p.g.destroy();
    }
    this.particles = [];
  }

  destroy() {
    this.reset();
    for (const sprite of this.spritePool) sprite.destroy();
    this.spritePool.length = 0;
    this.layer.destroy({ children: true });
  }

  private acquireSprite(): Sprite {
    const sprite = this.spritePool.pop() ?? this.createSprite();
    sprite.visible = true;
    this.layer.addChild(sprite);
    return sprite;
  }

  private releaseSprite(sprite: Sprite) {
    this.layer.removeChild(sprite);
    if (this.transientTextures.delete(sprite.texture)) {
      sprite.texture.destroy(true);
      sprite.texture = Texture.EMPTY;
    }
    sprite.visible = false;
    this.spritePool.push(sprite);
  }

  private createSprite(): Sprite {
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    return sprite;
  }

  private spawn(
    spawner: ArtCruiseEffectSpawner,
    context: ArtCruiseEffectContext,
  ) {
    if (this.effects.length >= MAX_EFFECTS) {
      const effect = this.effects.shift();
      if (effect) this.releaseSprite(effect.sprite);
    }

    this.effects.push(spawner(context));
  }
}
