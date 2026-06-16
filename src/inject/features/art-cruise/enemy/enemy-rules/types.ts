export type ArtCruiseEnemyRank = "grunt" | "boss";

/** circle弾の色アート種別 */
export type ArtCruiseBulletColor =
  | "blue"
  | "red"
  | "green"
  | "yellow"
  | "purple";

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
  | "spreadBurst"
  | "crossFire"
  | "bossSineWave"
  | "aimedBurst"
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
  | "bossGigantoRing";

export type ArtCruiseBulletPatternContext = {
  enemyPos: { x: number; y: number };
  playerPos: { x: number; y: number };
  bounds: { width: number; height: number };
  now: number;
  tuning?: ArtCruiseBulletPatternTuning;
};

export type ArtCruiseBulletPatternTuning = {
  speedScale?: number;
  accelScale?: number;
  sizeScale?: number;
  delayScale?: number;
  intervalScale?: number;
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
  speed: number;
  /** 進行方向への加速度(px/s^2)。負値で減速→停止→逆走する。未指定は0(等速)。 */
  accel?: number;
  size?: number;
  delayMs?: number;
  origin?: { x: number; y: number };
  splitOnBoundary?: boolean;
  maxAgeMs?: number;
  shape?: "circle" | "laser" | "muzzle" | "capsule";
  length?: number;
  trailMs?: number;
  /** circle弾の色アート選択。未指定はblue。 */
  bulletColor?: ArtCruiseBulletColor;
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
