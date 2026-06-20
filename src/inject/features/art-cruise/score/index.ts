import type { ArtCruiseEnemyConfig } from "../enemy/enemy-rules/types";

export {
  getHighScore,
  recordHighScore,
  type ArtCruiseHighScore,
  type ArtCruiseHighScoreResult,
} from "./storage";

export class ArtCruiseScore {
  private value = 0;
  private startedAt = 0;
  private survivalMs = 0;

  reset = (now: number) => {
    this.value = 0;
    this.startedAt = now;
    this.survivalMs = 0;
  };

  addDamage = (enemy: ArtCruiseEnemyConfig, damage: number) => {
    this.value += Math.max(0, damage) * enemy.score.damage;
  };

  addDefeat = (enemy: ArtCruiseEnemyConfig) => {
    this.value += enemy.score.defeat;
  };

  update = (now: number) => {
    if (!this.startedAt) this.startedAt = now;
    this.survivalMs = now - this.startedAt;
  };

  get score() {
    return this.value;
  }

  get survivalTimeMs() {
    return this.survivalMs;
  }
}
