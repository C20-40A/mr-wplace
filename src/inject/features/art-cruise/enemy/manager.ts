import { Container, Sprite } from "pixi.js";
import { createLauncherSprite } from "./enemy-bullet";
import type { ArtCruiseEnemyEntity } from "./enemy-entity";
import {
  getBulletPatternLauncherOrigins,
  getBulletPatternShotSeId,
} from "./enemy-bullet-patterns";
import { ArtCruiseEnemyBulletManager } from "./enemy-bullet-manager";
import type { ArtCruiseSeId } from "../audio/types";

export { ArtCruiseEnemyBulletManager };

export class ArtCruiseEnemyManager {
  private enemies: ArtCruiseEnemyEntity[] = [];
  private launcherSprites: Sprite[] = [];
  private launcherContainer = new Container();
  private launcherOriginsDirty = true;

  constructor(
    private readonly container: Container,
    private readonly bulletManager: ArtCruiseEnemyBulletManager,
    private readonly onRemove?: (enemy: ArtCruiseEnemyEntity, defeated: boolean) => void,
    private readonly onShoot?: (seId?: ArtCruiseSeId) => void,
  ) {
    this.container.addChild(this.launcherContainer);
  }

  addEnemy(enemy: ArtCruiseEnemyEntity) {
    this.enemies.push(enemy);
    this.container.addChild(enemy.view);
    this.launcherOriginsDirty = true;
  }

  update(
    now: number,
    deltaSeconds: number,
    bounds: { width: number; height: number },
    playerPos: { x: number; y: number },
  ) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy?.view) continue;

      // スクワッドに所属している場合は、その中で移動が制御されるためここではスキップ
      // ただし、firing判定や画面外判定はマネージャー側で一括して行う
      if (!enemy.squadId) {
        enemy.update(now, deltaSeconds);
      }

      // 射撃処理
      const spawns = enemy.tryFire(now, bounds, playerPos);
      if (spawns) {
        this.bulletManager.addBullets(spawns, enemy.view.x, enemy.view.y, now);
        this.onShoot?.(getBulletPatternShotSeId(enemy.bulletPattern));
      }

      // 画面外判定
      if (enemy.isOutOfBounds(bounds, now)) {
        this.removeEnemy(i, false);
      }
    }

    if (this.launcherOriginsDirty) this.syncLaunchers(bounds);
  }

  private syncLaunchers(bounds: { width: number; height: number }) {
    this.launcherOriginsDirty = false;
    // アクティブな敵が撃つパターンのうち、ランチャー基点を持つ最初のものを採用する。
    const origins = this.resolveLauncherOrigins(bounds);

    if (!origins) {
      this.clearLaunchers();
      return;
    }

    this.clearLaunchers();
    for (const origin of origins) {
      const sprite = createLauncherSprite();
      sprite.position.set(origin.x, origin.y);
      this.launcherContainer.addChild(sprite);
      this.launcherSprites.push(sprite);
    }
  }

  private resolveLauncherOrigins(bounds: {
    width: number;
    height: number;
  }): { x: number; y: number }[] | null {
    for (const enemy of this.enemies) {
      for (const pattern of enemy.bulletPatterns) {
        const origins = getBulletPatternLauncherOrigins(pattern, bounds);
        if (origins) return origins;
      }
    }
    return null;
  }

  private clearLaunchers() {
    for (const sprite of this.launcherSprites) sprite.destroy();
    this.launcherSprites = [];
  }

  removeEnemy(index: number, defeated = true) {
    const enemy = this.enemies[index];
    if (!enemy) return null;

    enemy.view.destroy({ children: true });
    const last = this.enemies.pop();
    if (last && index < this.enemies.length) this.enemies[index] = last;
    this.launcherOriginsDirty = true;
    this.onRemove?.(enemy, defeated);
    return enemy;
  }

  get activeEnemies() {
    return this.enemies;
  }

  invalidateLauncherOrigins() {
    this.launcherOriginsDirty = true;
  }

  reset() {
    for (const enemy of this.enemies) {
      enemy.view.destroy({ children: true });
    }
    this.enemies = [];
    this.clearLaunchers();
    this.launcherOriginsDirty = true;
    this.bulletManager.reset();
  }
}
