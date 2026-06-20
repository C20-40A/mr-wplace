import type { ArtCruiseBulletPatternModule } from "../../enemy-rules/types";
import {
  bossReflectLaserPattern,
  bossSineWavePattern,
} from "./boss-aimed-patterns";
import {
  bossAbyssalUpdraftPattern,
  bossEdgeBeamPattern,
  bossFlappyGatePattern,
  bossFrozenLatticePattern,
  bossPerimeterGapRingPattern,
  bossRovingTurretPattern,
  bossSideKunaiBarragePattern,
  bossStarfallPattern,
  bossTopIceRainPattern,
  bossWeavingStreamPattern,
} from "./boss-launcher-patterns";
import {
  bossBigRingPattern,
  bossClusterVolleyPattern,
  bossDenseRingPattern,
  bossGalaxyVortexPattern,
  bossGigantoRingPattern,
  bossLotusBloomPattern,
} from "./boss-ring-patterns";
import {
  aimedFanPattern,
  burstPattern,
  crossFirePattern,
  nonePattern,
  petalRingPattern,
  ringPulsePattern,
  spiralShotPattern,
  switchFanPattern,
} from "./grunt-patterns";

export {
  getAbyssalUpdraftOrigins,
  getEdgeBeamOrigins,
  getFrozenLatticeOrigins,
  getPerimeterGapRingOrigins,
  getRovingTurretOrigins,
  getSideKunaiBarrageOrigins,
  getStarfallOrigins,
  getTopIceRainOrigins,
  getWeavingStreamOrigins,
} from "./boss-launcher-patterns";

export const BUILTIN_BULLET_PATTERNS: ArtCruiseBulletPatternModule[] = [
  nonePattern,
  aimedFanPattern,
  ringPulsePattern,
  burstPattern,
  crossFirePattern,
  bossSineWavePattern,
  bossBigRingPattern,
  bossPerimeterGapRingPattern,
  bossReflectLaserPattern,
  bossDenseRingPattern,
  bossWeavingStreamPattern,
  spiralShotPattern,
  petalRingPattern,
  switchFanPattern,
  bossGalaxyVortexPattern,
  bossLotusBloomPattern,
  bossStarfallPattern,
  bossFrozenLatticePattern,
  bossClusterVolleyPattern,
  bossAbyssalUpdraftPattern,
  bossRovingTurretPattern,
  bossSideKunaiBarragePattern,
  bossTopIceRainPattern,
  bossEdgeBeamPattern,
  bossFlappyGatePattern,
  bossGigantoRingPattern,
];
