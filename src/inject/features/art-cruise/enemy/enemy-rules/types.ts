export type ArtCruiseEnemyRank = "grunt" | "boss";

/** circle弾の色アート種別 */
export type ArtCruiseBulletColor =
  | "blue"
  | "red"
  | "green"
  | "yellow"
  | "purple";

export type ArtCruiseBulletVariant =
  | "greenCapsule"
  | "iceCapsule"
  | "kunaiCapsule"
  | "smallSilver"
  | "silverCapsule";

export type ArtCruiseBurstBulletArt =
  | ArtCruiseBulletColor
  | ArtCruiseBulletVariant
  | "bullet-yellow-circle";

export type ArtCruiseEnemyMovementId =
  | "frontCross"
  | "downLine"
  | "diagonalLeft"
  | "diagonalRight"
  | "sidePeek"
  | "none";

export type ArtCruiseEnemyBulletPatternId =
  | "none"
  | "aimedFan"
  | "ringPulse"
  | "burst"
  | "crossFire"
  | "bossSineWave"
  | "bossBigRing"
  | "bossPerimeterGapRing"
  | "bossReflectLaser"
  | "bossDenseRing"
  | "bossWeavingStream"
  | "spiralShot"
  | "petalRing"
  | "switchFan"
  | "bossGalaxyVortex"
  | "bossLotusBloom"
  | "bossStarfall"
  | "bossFrozenLattice"
  | "bossClusterVolley"
  | "bossAbyssalUpdraft"
  | "bossRovingTurret"
  | "bossSideKunaiBarrage"
  | "bossTopIceRain"
  | "bossEdgeBeam"
  | "bossFlappyGate"
  | "bossGigantoRing";

export type ArtCruiseEdgeBarrageConfig = {
  aimAtPlayer?: boolean;
  fireMode?: "all" | "random" | "sequence";
  turretGapPx?: number;
  bulletsPerWave?: number;
  delayStepMs?: number;
  randomDelayMs?: number;
  spreadRad?: number;
  baseSpeed?: number;
  accel?: number;
};

export type ArtCruiseEdgeBeamConfig = {
  turretLayout?: "top" | "perimeter" | "corners";
  fireMode?: "all" | "random" | "sequence";
  beamCount?: number;
  beamsPerTurret?: number;
  angleMode?: "straight" | "center" | "random" | "fixed";
  fixedAngle?: number;
  warningMs?: number;
  lifeMs?: number;
  delayStepMs?: number;
  spreadRad?: number;
};

export type ArtCruiseBurstConfig = {
  aimAtPlayer?: boolean;
  bulletArt?: ArtCruiseBurstBulletArt;
  spreadRad?: number;
  bulletCount?: number;
  bulletSize?: number;
  baseSpeed?: number;
  speedStep?: number;
  accel?: number;
  minSpeed?: number;
  angleJitterRad?: number;
  repeatCount?: number;
  repeatDelayMs?: number;
  delayStepMs?: number;
};

export type ArtCruiseAbyssalUpdraftConfig = {
  spreadRad?: number;
};

export type ArtCruiseDenseRingConfig = {
  fireSlots?: number;
  cycleSlots?: number;
  slotMs?: number;
  count?: number;
  phaseMs?: number;
  phaseStepRad?: number;
  baseSpeed?: number;
  altSpeedAdd?: number;
  bulletSize?: number;
  delayMs?: number;
  bulletArt?: ArtCruiseBurstBulletArt;
  bulletColor?: ArtCruiseBulletColor;
  bulletVariant?: ArtCruiseBulletVariant;
};

export type ArtCruiseFlappyGateSide =
  | "right"
  | "left"
  | "top"
  | "bottom"
  | "random"
  | "cycle";

export type ArtCruiseFlappyGateConfig = {
  side?: ArtCruiseFlappyGateSide;
  gateCount?: number;
  gapSize?: number;
  thickness?: number;
  baseSpeed?: number;
  delayStepMs?: number;
  lifeMs?: number;
  gapJitterPx?: number;
  gapMoveMinPx?: number;
  gapMoveMaxPx?: number;
};

export type ArtCruiseReflectLaserConfig = {
  offsets?: number[];
  count?: number;
  weaveRad?: number;
  weaveMs?: number;
  baseSpeed?: number;
  altSpeedAdd?: number;
  bulletSize?: number;
  delayStepMs?: number;
  splitOnBoundary?: boolean;
  lifeMs?: number;
  length?: number;
  trailMs?: number;
};

export type ArtCruiseBulletPatternContext = {
  enemyPos: { x: number; y: number };
  playerPos: { x: number; y: number };
  bounds: { width: number; height: number };
  now: number;
  tuning?: ArtCruiseBulletPatternTuning;
};

export type ArtCruiseBulletPatternTuning = {
  speedScale?: number;
  accel?: number;
  accelScale?: number;
  minSpeed?: number;
  sizeScale?: number;
  delayScale?: number;
  intervalScale?: number;
  sideKunai?: ArtCruiseEdgeBarrageConfig;
  topIce?: ArtCruiseEdgeBarrageConfig;
  edgeBeam?: ArtCruiseEdgeBeamConfig;
  burst?: ArtCruiseBurstConfig;
  abyssalUpdraft?: ArtCruiseAbyssalUpdraftConfig;
  denseRing?: ArtCruiseDenseRingConfig;
  flappyGate?: ArtCruiseFlappyGateConfig;
  reflectLaser?: ArtCruiseReflectLaserConfig;
};

export type ArtCruiseEnemyConfig = {
  rank: ArtCruiseEnemyRank;
  hp: number;
  score: {
    damage: number;
    defeat: number;
  };
};

export type ArtCruiseEnemyDefinition = {
  movement: ArtCruiseEnemyMovementId;
  getBulletPattern: () => ArtCruiseEnemyBulletPatternId;
  createConfig: () => ArtCruiseEnemyConfig;
};

export type ArtCruiseEnemyBulletSpawn = {
  angle: number;
  /** 未指定なら angle 方向へ移動。矩形壁など、向きと移動方向を分けたい時だけ使う。 */
  moveAngle?: number;
  speed: number;
  /** 進行方向への加速度(px/s^2)。負値で減速→停止→逆走する。未指定は0(等速)。 */
  accel?: number;
  /** 加速度つき移動時の最低速度。未指定なら速度下限なし。 */
  minSpeed?: number;
  size?: number;
  delayMs?: number;
  origin?: { x: number; y: number };
  splitOnBoundary?: boolean;
  maxAgeMs?: number;
  shape?: "circle" | "laser" | "muzzle" | "capsule" | "beam" | "gateBeam";
  length?: number;
  warningMs?: number;
  trailMs?: number;
  /** circle弾の色アート選択。未指定はblue。 */
  bulletColor?: ArtCruiseBulletColor;
  /** capsuleなど、色とは独立した弾画像の個別選択。 */
  bulletVariant?: ArtCruiseBulletVariant;
  /** falseなら進行方向に画像を回転しない。未指定はtrue。 */
  rotateToAngle?: boolean;
  /** 画像の正面と進行方向の差を補正する描画用回転。 */
  rotationOffset?: number;
  shotSeId?: import("../../audio/types").ArtCruiseSeId;
};

/** 弾幕パターンのメタ情報 — boss フェーズ構成やランチャー描画の単一の真実 */
export type ArtCruiseBulletPatternMeta = {
  /** boss/grunt 分類。未指定は grunt 扱い。 */
  rank?: ArtCruiseEnemyRank;
  /** boss フェーズ時の必殺技名 */
  ultimateName?: string;
  /** プレイエリア周囲のランチャー基点。指定時のみ manager がランチャー描画する。 */
  launcherOrigins?: (bounds: {
    width: number;
    height: number;
  }) => { x: number; y: number }[];
};

/** 弾幕パターンのモジュールインターフェース — idとcreatorをセットで登録 */
export type ArtCruiseBulletPatternModule = ArtCruiseBulletPatternMeta & {
  id: ArtCruiseEnemyBulletPatternId;
  fireIntervalMs: number;
  shotSeId?: import("../../audio/types").ArtCruiseSeId;
  create: (ctx: ArtCruiseBulletPatternContext) => ArtCruiseEnemyBulletSpawn[];
};
