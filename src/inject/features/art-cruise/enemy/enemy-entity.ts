import type { Container } from "pixi.js";
import type { ArtCruisePixiEnemy } from "./types";
import { updatePixiEnemyMovement } from "./enemy-movement";
import {
  createEnemyBulletSpawns,
  getBulletPatternFireInterval,
} from "./enemy-bullet-patterns";
import type { ArtCruiseEnemyBulletSpawn } from "./enemy-rules/types";

export type ArtCruiseEnemyDamageResult = {
  defeated: boolean;
  phaseChanged: boolean;
};

export class ArtCruiseEnemyEntity {
  constructor(private readonly data: ArtCruisePixiEnemy) {}

  get view(): Container {
    return this.data.view;
  }

  get config() {
    return this.data.config;
  }

  /** 同時発射する弾幕パターン群 */
  get bulletPatterns() {
    return this.data.bulletPatterns;
  }

  /** 代表パターン（互換用）。launcher 判定や debug 表示で参照される。 */
  get bulletPattern() {
    return this.data.bulletPatterns[0];
  }

  get movement() {
    return this.data.movement;
  }

  get radius() {
    return this.data.radius;
  }

  get hp() {
    return this.data.hp;
  }

  set hp(value: number) {
    this.data.hp = value;
  }

  get squadId() {
    return this.data.squadId;
  }

  get rawData() {
    return this.data;
  }

  update(now: number, deltaSeconds: number) {
    updatePixiEnemyMovement(this.data, now, deltaSeconds);
  }

  tryFire(
    now: number,
    bounds: { width: number; height: number },
    playerPos: { x: number; y: number },
  ): ArtCruiseEnemyBulletSpawn[] | null {
    // プレイエリア内（表示範囲内）にいるときのみ弾を撃てる
    if (
      this.view.x < 0 ||
      this.view.x > bounds.width ||
      this.view.y < 0 ||
      this.view.y > bounds.height
    ) {
      return null;
    }

    const enemyPos = { x: this.view.x, y: this.view.y };
    let spawns: ArtCruiseEnemyBulletSpawn[] | null = null;

    // 各パターンを独立したインターバルで判定し、撃てるものを合成する。
    for (const pattern of this.data.bulletPatterns) {
      if (pattern === "none") continue;
      const lastFired = this.data.lastFiredAt[pattern] ?? 0;
      if (
        now - lastFired <
        getBulletPatternFireInterval(pattern, this.data.bulletTuning)
      )
        continue;

      this.data.lastFiredAt[pattern] = now;
      const patternSpawns = createEnemyBulletSpawns(pattern, {
        enemyPos,
        playerPos,
        bounds,
        now,
        tuning: this.data.bulletTuning,
      });
      if (patternSpawns.length === 0) continue;
      (spawns ??= []).push(...patternSpawns);
    }

    return spawns;
  }

  isInvincible(now: number) {
    return (this.data.invincibleUntil ?? 0) > now;
  }

  setInvincible(until: number) {
    this.data.invincibleUntil = until;
  }

  takeDamage(amount: number, now?: number): ArtCruiseEnemyDamageResult {
    if (now !== undefined && this.isInvincible(now)) return { defeated: false, phaseChanged: false };
    this.data.hp -= amount;
    if (this.data.hp > 0) return { defeated: false, phaseChanged: false };
    if (this.advanceBossPhase()) return { defeated: false, phaseChanged: true };
    return { defeated: true, phaseChanged: false };
  }

  private advanceBossPhase() {
    const phases = this.data.bossPhases;
    if (this.data.config.rank !== "boss" || !phases?.length) return false;

    const nextIndex = (this.data.bossPhaseIndex ?? 0) + 1;
    const next = phases[nextIndex];
    if (!next) return false;

    this.data.bossPhaseIndex = nextIndex;
    this.data.bulletPatterns = next.bulletPatterns;
    this.data.bulletTuning = next.bulletTuning;
    this.data.hp = next.hp;
    // 新フェーズのパターンは即時発射できるようタイマーをクリアする。
    this.data.lastFiredAt = {};
    return true;
  }

  isOutOfBounds(bounds: { width: number; height: number }, now: number): boolean {
    if (this.config.rank === "boss") return false;

    const elapsed = now - this.data.spawnedAt;
    // 安全網: 何らかの理由で画面外に退場できなかった grunt も
    // 一定時間で強制消滅させ、クリアゲートの永久ブロック(進行不能)を防ぐ。
    if (elapsed > 20000) return true;
    const margin = 160;
    if (this.view.x < -margin) return true;
    if (this.view.y > bounds.height + margin) return true;
    if (this.view.y < -margin && elapsed > 6000) return true;
    if (elapsed < 2200) return false;
    return this.view.x > bounds.width + margin;
  }
}
