import { Assets, Container, Graphics, Sprite } from "pixi.js";
import type { ArtCruiseMandalaUrls } from "./types";

const OVERLAY_ALPHA = 0.3;
const MANDALA_ALPHA_NORMAL = 0;
const MANDALA_ALPHA_BOSS = 0.45;
const MANDALA_SCALE_BASE = 1.1;
const MANDALA_ROTATE_SPEED = 0.22; // rad/s
const ALPHA_TRANSITION_SPEED = 1.8; // per second

type MandalaSprite = Sprite & {
  rotationSpeed: number;
  scaleFactor: number;
};

export class ArtCruiseBgLayer {
  public readonly view = new Container();

  private readonly overlay = new Graphics();
  private readonly mandalaContainer = new Container();
  private sprites: MandalaSprite[] = [];

  private bossActive = false;
  private currentAlpha = 0;
  private loaded = false;
  private overlayWidth = 0;
  private overlayHeight = 0;

  constructor(private readonly urls?: ArtCruiseMandalaUrls) {
    this.view.addChild(this.overlay, this.mandalaContainer);
    this.mandalaContainer.alpha = 0;
    this.mandalaContainer.renderable = false;
  }

  async load(logicalWidth: number, logicalHeight: number) {
    if (this.loaded || !this.urls) return;
    this.loaded = true;

    const [texB, texC] = await Promise.all([
      Assets.load(this.urls.b),
      Assets.load(this.urls.c),
    ]);

    const configs = [
      {
        tex: texB,
        scale: MANDALA_SCALE_BASE * 0.72,
        alpha: 0.45,
        speed: -MANDALA_ROTATE_SPEED * 0.65,
      },
      {
        tex: texC,
        scale: MANDALA_SCALE_BASE * 1.35,
        alpha: 0.45,
        speed: MANDALA_ROTATE_SPEED * 0.42,
      },
    ];

    for (const cfg of configs) {
      const s = new Sprite(cfg.tex) as MandalaSprite;
      s.anchor.set(0.5);
      s.position.set(logicalWidth / 2, logicalHeight / 2);
      s.alpha = cfg.alpha;
      s.rotationSpeed = cfg.speed;
      s.scaleFactor = cfg.scale;
      const dim = Math.min(logicalWidth, logicalHeight);
      s.scale.set(
        (dim * cfg.scale) / Math.max(s.texture.width, s.texture.height),
      );
      this.mandalaContainer.addChild(s);
      this.sprites.push(s);
    }
  }

  drawOverlay(width: number, height: number) {
    if (this.overlayWidth === width && this.overlayHeight === height) return;
    this.overlayWidth = width;
    this.overlayHeight = height;
    this.overlay.clear();
    this.overlay
      .rect(0, 0, width, height)
      .fill({ color: 0x000000, alpha: OVERLAY_ALPHA });
  }

  setBossActive(active: boolean) {
    this.bossActive = active;
    if (active) this.mandalaContainer.renderable = true;
  }

  reset() {
    this.bossActive = false;
    this.currentAlpha = 0;
    this.mandalaContainer.alpha = 0;
    this.mandalaContainer.renderable = false;
  }

  update(deltaSeconds: number, width: number, height: number) {
    this.drawOverlay(width, height);

    const targetAlpha = this.bossActive
      ? MANDALA_ALPHA_BOSS
      : MANDALA_ALPHA_NORMAL;
    const diff = targetAlpha - this.currentAlpha;
    const step = ALPHA_TRANSITION_SPEED * deltaSeconds;

    if (Math.abs(diff) <= step) {
      this.currentAlpha = targetAlpha;
    } else {
      this.currentAlpha += Math.sign(diff) * step;
    }

    this.mandalaContainer.alpha = this.currentAlpha;
    this.mandalaContainer.renderable = this.currentAlpha > 0.001;

    if (this.currentAlpha > 0.001) {
      for (const s of this.sprites) {
        s.rotation += s.rotationSpeed * deltaSeconds;
      }
    }
  }

  resize(logicalWidth: number, logicalHeight: number) {
    const dim = Math.min(logicalWidth, logicalHeight);
    for (const s of this.sprites) {
      s.position.set(logicalWidth / 2, logicalHeight / 2);
      s.scale.set(
        (dim * s.scaleFactor) / Math.max(s.texture.width, s.texture.height),
      );
    }
    this.drawOverlay(logicalWidth, logicalHeight);
  }
}
