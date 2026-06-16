import { Container, Sprite, Texture } from "pixi.js";

/**
 * 汎用Spriteプール — 弾など高頻度に生成/破棄されるSpriteを使い回す。
 *
 * new/destroyを繰り返さずvisibleの切替で再利用し、GC負荷を抑える。
 * 見た目(サイズ/回転/blendMode/テクスチャ)の設定は呼び出し側の責務。
 * プールはSpriteの貸出(acquire)/返却(release)だけを担う。
 */
export class SpritePool {
  private readonly free: Sprite[] = [];

  constructor(private readonly layer: Container) {}

  /** プールからSpriteを借りる。空なら新規生成。layerには未追加で返す */
  acquire(): Sprite {
    const sprite = this.free.pop();
    if (sprite) {
      sprite.visible = true;
      return sprite;
    }
    const created = new Sprite(Texture.EMPTY);
    created.anchor.set(0.5);
    return created;
  }

  /** Spriteをプールへ返す。layerから外し非表示にする */
  release(sprite: Sprite): void {
    sprite.visible = false;
    sprite.removeFromParent();
    this.free.push(sprite);
  }

  /** プール保持分を完全破棄する。リセット/破棄時に呼ぶ */
  destroy(): void {
    for (const sprite of this.free) sprite.destroy();
    this.free.length = 0;
  }
}

/**
 * 「Container + その中のSprite1枚」をセットで使い回すプール。
 *
 * enemy弾のように view=Container, 中身=Sprite1枚 の構造を再利用する。
 * 借りるたびに形状(anchor/rotation/blendMode/size/texture)を上書き設定する前提。
 */
export type PooledBulletView = {
  view: Container;
  sprite: Sprite;
};

export class BulletViewPool {
  private readonly free: PooledBulletView[] = [];

  /** セットを借りる。空なら新規生成。layerには未追加で返す */
  acquire(): PooledBulletView {
    const pooled = this.free.pop();
    if (pooled) {
      pooled.view.visible = true;
      pooled.view.alpha = 1;
      return pooled;
    }
    const view = new Container();
    const sprite = new Sprite(Texture.EMPTY);
    view.addChild(sprite);
    return { view, sprite };
  }

  /** セットをプールへ返す。layerから外し非表示にする */
  release(pooled: PooledBulletView): void {
    pooled.view.visible = false;
    pooled.view.removeFromParent();
    this.free.push(pooled);
  }

  /** プール保持分を完全破棄する */
  destroy(): void {
    for (const pooled of this.free) pooled.view.destroy({ children: true });
    this.free.length = 0;
  }
}
