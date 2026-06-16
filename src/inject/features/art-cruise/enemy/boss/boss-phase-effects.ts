import type { ArtCruiseEffectManager } from "../../effects";
import type { ArtCruiseEnemyBulletManager } from "../enemy-bullet-manager";
import type { ArtCruiseAudioManager } from "../../audio/manager";

type BossPhaseEffectDeps = {
  effectManager: ArtCruiseEffectManager;
  enemyBulletManager: ArtCruiseEnemyBulletManager;
  audio?: ArtCruiseAudioManager | null;
  bounds: { width: number; height: number };
};

export const playBossPhaseTransition = (
  { effectManager, enemyBulletManager, audio, bounds }: BossPhaseEffectDeps,
  x: number,
  y: number,
  now: number,
  phaseName?: string,
) => {
  audio?.playSe("grunt-down");

  if (phaseName) {
    effectManager.spawnBossPhaseTransitionWithName(x, y, now, bounds, phaseName);
  } else {
    effectManager.spawnBossPhaseChange(x, y, now);
  }

  effectManager.spawnBulletClearRings(
    enemyBulletManager.clearForEnemyDefeat(now),
    now,
  );
};
