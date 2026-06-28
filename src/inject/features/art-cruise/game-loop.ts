import "pixi.js/unsafe-eval";
import { Application, Container, Graphics, Ticker } from "pixi.js";
import type { ArtCruiseMapLike, ArtCruiseRuntime } from "./runtime";
import {
  BULLET_INTERVAL_MS,
  CANVAS_ROOT_ID,
  ENEMY_BULLET_MAX_COUNT,
  ENEMY_MAX_COUNT,
  GAME_LOGICAL_HEIGHT,
  GAME_LOGICAL_WIDTH,
  PLAYER_HIT_RADIUS,
  type ResolutionLevel,
  getDPadEnabled as readDPadEnabled,
  getGalleryEnemyFallbackEnabled as readGalleryEnemyFallbackEnabled,
  getDynamicEnemyMaxSizePx,
  getMusicVolume as readMusicVolume,
  getResolutionLevel,
  getSeVolume as readSeVolume,
  resolveResolutionValue,
  setDPadEnabled as persistDPadEnabled,
  setGalleryEnemyFallbackEnabled as persistGalleryEnemyFallbackEnabled,
  setDynamicEnemyMaxSizePx,
  setMusicVolume as persistMusicVolume,
  setResolutionLevel,
  setSeVolume as persistSeVolume,
} from "./constants";
import {
  ArtCruiseBossController,
  playBossPhaseTransition as playBossPhaseTransitionEffect,
} from "./enemy/boss";
import { hitTestHittableBullet } from "./enemy/enemy-bullet/hitbox";
import { drawDebugHitboxes as renderDebugHitboxes } from "./debug/hitbox-overlay";
import {
  preloadFallbackEnemyTextures,
  refreshGalleryFallbackEnemyTextures,
} from "./enemy/enemy-graphics/fallback-enemy-view";
import {
  ArtCruisePixiEnemyGraphicPool,
  type ArtCruiseEnemyScannerLike,
} from "./enemy/enemy-graphics/pixi-enemy-graphic-pool";
import { ArtCruiseSquad } from "./enemy/enemy-movement/squad";
import { ArtCruiseStageDirector } from "./stage-director";
import {
  ArtCruiseEnemyEntity,
  ArtCruiseEnemyManager,
  ArtCruiseEnemyBulletManager,
  ArtCruiseSpawner,
} from "./enemy";
import type { ArtCruisePixiPlayerBullet } from "./enemy/types";
import type {
  ArtCruiseDebugBossOptions,
  ArtCruiseDebugConfig,
  ArtCruiseDebugSpawnOptions,
} from "./debug/types";
import type { ArtCruiseViewport } from "./viewport";
import { ArtCruiseShip } from "./player/ship";
import { ArtCruiseInput } from "./input";
import { ArtCruiseBackground } from "./background";
import { ArtCruiseBgLayer } from "./bg-layer";
import { ArtCruiseEffectManager } from "./effects";
import {
  spawnPlayerBullet,
  updatePlayerBullets,
  removePlayerBullet,
  destroyPlayerBulletPool,
} from "./player/player-bullets";
import { ArtCruiseScore, recordHighScore } from "./score";
import type { ArtCruiseHighScoreResult } from "./score";
import { ArtCruiseAudioManager } from "./audio";
import type { ArtCruiseAudioUrls, ArtCruiseSeId } from "./audio";
import type { ArtCruiseMandalaUrls } from "./bg-layer";
import { ART_CRUISE_BULLET_PATTERN_IDS } from "./enemy/enemy-bullet-patterns";
import { recordBossClear } from "./boss-mode/storage";

/** 現フェーズの最大HPに対する現在HPの割合 (0-1)。HUDゲージ用。 */
const getBossHpRatio = (enemy: ArtCruiseEnemyEntity) => {
  const phaseIndex = enemy.rawData.bossPhaseIndex ?? 0;
  const phaseMaxHp = enemy.rawData.bossPhases?.[phaseIndex]?.hp;
  if (!phaseMaxHp || phaseMaxHp <= 0) return 0;
  return Math.max(0, Math.min(1, enemy.hp / phaseMaxHp));
};

const GAME_BOUNDS = {
  width: GAME_LOGICAL_WIDTH,
  height: GAME_LOGICAL_HEIGHT,
};

/** スコア/生存時間 HUD の更新間隔。60fps の DOM 書き換えは視認できないため間引く。 */
const SCORE_NOTIFY_INTERVAL_MS = 100;
const CONTINUE_HP = 3;

type ArtCruiseEnemyScannerRuntime = ArtCruiseEnemyScannerLike & {
  update: (now: number) => void;
  setMaxSizePx: (sizePx: number) => void;
  destroy: () => void;
};

const createDisabledEnemyScanner = (): ArtCruiseEnemyScannerRuntime => ({
  getVersion: () => 0,
  getCandidates: () => [],
  update: () => {},
  setMaxSizePx: () => {},
  destroy: () => {},
});

type ArtCruiseGameLoopOptions = {
  map: ArtCruiseMapLike;
  runtime?: ArtCruiseRuntime;
  viewport: ArtCruiseViewport;
  audioUrls?: ArtCruiseAudioUrls;
  mandalaUrls?: ArtCruiseMandalaUrls;
  debug?: ArtCruiseDebugConfig;
  onScoreUpdate?: (score: number, survivalMs: number) => void;
  onHpChange?: (hp: number) => void;
  onGameOver?: (
    score: number,
    survivalMs: number,
    level: number,
    continueCount: number,
    highScore: ArtCruiseHighScoreResult | null,
  ) => void;
  // BOSS 練習モードでそのボスを撃破した時に発火（level, クリアタイム ms）。
  onBossClear?: (level: number, timeMs: number) => void;
  onStageUpdate?: (state: {
    level: number;
    sinceBoss: number;
    requiredWavesBeforeBoss: number;
    lastModuleId: string;
    fps?: number;
    enemyBullets?: number;
    enemyBulletUpdateMs?: number;
  }) => void;
  onBossHudShow?: (state: {
    name: string;
    phaseCount: number;
    phaseIndex: number;
    hpRatio: number;
  }) => void;
  onBossHudUpdate?: (
    hpRatio: number,
    phaseIndex?: number,
    phaseCount?: number,
  ) => void;
  onBossHudHide?: () => void;
};

type FrameContext = {
  now: number;
  deltaSeconds: number;
  bounds: { width: number; height: number };
};

type HitPoint = {
  x: number;
  y: number;
};

export class ArtCruiseGameLoop {
  private readonly options: ArtCruiseGameLoopOptions;
  private readonly app = new Application();
  private readonly root = new Container();
  private readonly background = new ArtCruiseBackground();
  private readonly bgLayer: ArtCruiseBgLayer;
  private readonly gameLayer = new Container();
  private readonly debugGraphics: Graphics | null;
  private readonly scanner: ArtCruiseEnemyScannerRuntime;
  private readonly enemyGraphics: ArtCruisePixiEnemyGraphicPool;
  private readonly enemyBulletManager = new ArtCruiseEnemyBulletManager(
    this.gameLayer,
    ENEMY_BULLET_MAX_COUNT,
  );
  private readonly effectManager = new ArtCruiseEffectManager(this.root);
  private readonly score = new ArtCruiseScore();
  private readonly enemyManager: ArtCruiseEnemyManager;
  private readonly bossController = new ArtCruiseBossController();
  private readonly bullets: ArtCruisePixiPlayerBullet[] = [];
  private readonly squads: ArtCruiseSquad[] = [];
  private readonly stageDirector = new ArtCruiseStageDirector({
    maxEnemies: ENEMY_MAX_COUNT,
  });
  private readonly spawner: ArtCruiseSpawner;
  private readonly ship: ArtCruiseShip;
  private readonly input: ArtCruiseInput;
  private readonly frame: FrameContext = {
    now: 0,
    deltaSeconds: 0,
    bounds: GAME_BOUNDS,
  };
  private readonly playerPos = { x: 0, y: 0 };
  private readonly enemyHitPoint: HitPoint = { x: 0, y: 0 };
  private audio: ArtCruiseAudioManager | null = null;

  private lastBulletAt = 0;
  private lastEnemyShotSeAt = 0;
  private lastScoreNotifyAt = 0;
  private gameTime = 0;
  private initialized = false;
  private active = false;
  private paused = false;
  private gameOver = false;
  // BOSS 練習モード: 指定 level のボスのみを召喚し、撃破で記録・クリア演出する。
  private bossModeLevel: number | null = null;
  // ボス出現時刻（タイム計測の起点）。null は計測中でない。
  private bossSpawnedAt: number | null = null;
  private continueCount = 0;
  private debugPanelOpen = false;
  private debugFrameCount = 0;
  private debugLastSampleAt = 0;
  private debugEnemyBulletUpdateMs = 0;
  private stopViewportListener: (() => void) | null = null;
  private restoreTileFetchBypass: (() => void) | null = null;
  private prescanTimer: number | null = null;

  constructor(options: ArtCruiseGameLoopOptions) {
    this.options = options;
    this.bgLayer = new ArtCruiseBgLayer(this.options.mandalaUrls);
    this.debugGraphics = this.options.debug?.showHitboxes
      ? new Graphics()
      : null;
    this.scanner = this.createEnemyScanner();
    this.enemyGraphics = new ArtCruisePixiEnemyGraphicPool(
      this.scanner,
      () => this.unitScale(),
    );
    this.enemyManager = new ArtCruiseEnemyManager(
      this.gameLayer,
      this.enemyBulletManager,
      (enemy, defeated) => this.handleEnemyRemoved(enemy, defeated),
      (seId) => this.handleEnemyShot(seId),
    );
    this.spawner = new ArtCruiseSpawner({
      enemyManager: this.enemyManager,
      bossController: this.bossController,
      enemyGraphics: this.enemyGraphics,
      stageDirector: this.stageDirector,
      squads: this.squads,
      unitScale: () => this.unitScale(),
      onBossSpawn: (enemy, spawnOptions) =>
        this.handleBossSpawn(enemy, spawnOptions),
    });
    this.ship = new ArtCruiseShip(1, 1);
    this.input = new ArtCruiseInput(this.options.viewport);
  }

  private createEnemyScanner = (): ArtCruiseEnemyScannerRuntime => {
    if (this.options.runtime?.enableDynamicTileEnemies === false)
      return createDisabledEnemyScanner();

    return (
      this.options.runtime?.createEnemyScanner?.(this.options.map) ??
      createDisabledEnemyScanner()
    );
  };

  /**
   * タイトル画面中に敵グラフィックを先読みする。ticker (= game.start) に
   * 依存せず実時間で scanner を駆動し、プレイ開始時に pool を埋めて
   * 初手の fallback 敵を抑制する。start() 時に停止する。
   */
  startPrescan = () => {
    if (this.prescanTimer !== null) return;
    this.scanner.update(performance.now());
    this.enemyGraphics.update();
    this.prescanTimer = window.setInterval(() => {
      this.scanner.update(performance.now());
      this.enemyGraphics.update();
    }, 1000);
  };

  private stopPrescan = () => {
    if (this.prescanTimer === null) return;
    clearInterval(this.prescanTimer);
    this.prescanTimer = null;
  };

  start = (options?: { bossLevel?: number }) => {
    if (this.active) return;

    this.bossModeLevel = options?.bossLevel ?? null;
    this.bossSpawnedAt = null;
    this.stopPrescan();
    this.active = true;
    this.gameOver = false;
    this.gameTime = 0;
    this.continueCount = 0;
    this.resetDebugStats();
    this.ship.reset();
    this.input.setTarget(
      GAME_LOGICAL_WIDTH * 0.5,
      GAME_LOGICAL_HEIGHT * ArtCruiseShip.BASE_RATIO,
    );
    this.options.onHpChange?.(this.ship.currentHp);
    this.score.reset(this.gameTime);
    this.options.onScoreUpdate?.(this.score.score, this.score.survivalTimeMs);
    if (this.options.runtime?.enableTileFetchBypass !== false)
      this.restoreTileFetchBypass ??=
        this.options.runtime?.installTileFetchBypass?.() ?? null;
    this.startAudio();
    void this.mount();
  };

  /** ゲームオーバー後のリトライ。盤面を初期化して再開する */
  restart = () => {
    if (!this.initialized) return;

    this.debugClearEnemies();
    this.enemyBulletManager.reset();
    this.stageDirector.reset();
    this.squads.length = 0;

    this.gameOver = false;
    this.gameTime = 0;
    this.continueCount = 0;
    this.lastBulletAt = 0;
    this.lastScoreNotifyAt = 0;
    this.resetDebugStats();
    this.bgLayer.reset();
    this.ship.reset();
    this.ship.view.position.set(
      GAME_LOGICAL_WIDTH * 0.5,
      GAME_LOGICAL_HEIGHT * ArtCruiseShip.BASE_RATIO,
    );
    this.input.setTarget(this.ship.x, this.ship.y);
    this.options.onHpChange?.(this.ship.currentHp);
    this.score.reset(this.gameTime);
    this.options.onScoreUpdate?.(this.score.score, this.score.survivalTimeMs);
    this.audio?.resetToStage();

    // BOSS 練習モードは同じボスへ即再挑戦する。
    this.bossSpawnedAt = null;
    if (this.bossModeLevel !== null)
      this.spawner.debugSpawnBossLevel(this.bossModeLevel, this.gameTime);
  };

  /** ゲームオーバー後のコンティニュー。進行レベルを保ち、スコアと現 wave を初期化して再開する */
  continueGame = () => {
    if (!this.initialized || !this.gameOver) return;

    const level = this.stageDirector.getState().level;
    const boss = this.enemyManager.activeEnemies.find(
      (enemy) => enemy.config.rank === "boss",
    );

    this.gameOver = false;
    this.continueCount += 1;
    this.lastBulletAt = 0;
    this.lastScoreNotifyAt = 0;
    this.bossSpawnedAt = null;
    this.resetDebugStats();
    this.bgLayer.reset();
    this.ship.reset(CONTINUE_HP);
    this.ship.view.position.set(
      GAME_LOGICAL_WIDTH * 0.5,
      GAME_LOGICAL_HEIGHT * ArtCruiseShip.BASE_RATIO,
    );
    this.input.setTarget(this.ship.x, this.ship.y);
    this.options.onHpChange?.(this.ship.currentHp);
    this.score.reset(this.gameTime);
    this.options.onScoreUpdate?.(this.score.score, this.score.survivalTimeMs);

    this.stageDirector.reset({ level });
    if (boss) {
      this.resetActiveBossForContinue(boss);
      return;
    }

    this.debugClearEnemies();
    this.audio?.resetToStage();
    if (this.bossModeLevel !== null)
      this.spawner.debugSpawnBossLevel(this.bossModeLevel, this.gameTime);
  };

  private resetActiveBossForContinue = (boss: ArtCruiseEnemyEntity) => {
    for (let i = this.enemyManager.activeEnemies.length - 1; i >= 0; i--) {
      if (this.enemyManager.activeEnemies[i] === boss) continue;
      this.enemyManager.removeEnemy(i, false);
    }
    this.enemyBulletManager.reset();
    for (let i = this.bullets.length - 1; i >= 0; i--)
      removePlayerBullet(this.bullets, i);
    this.squads.length = 0;

    boss.resetBossPhase(this.gameTime);
    boss.view.position.set(GAME_LOGICAL_WIDTH * 0.5, GAME_LOGICAL_HEIGHT * -0.14);
    boss.rawData.originX = boss.view.x;
    boss.rawData.originY = boss.view.y;
    this.bossController.setBoss(boss);
    this.handleBossSpawn(boss);
  };

  /** stage -> boss BGM crossfade（ボス出現時に呼ぶ想定の公開 API） */
  transitionToBossBgm = () =>
    this.audio?.transitionToBoss(this.getCurrentBossLevel());

  private startAudio = () => {
    if (this.audio || !this.options.audioUrls) return;
    this.audio = new ArtCruiseAudioManager(this.options.audioUrls, {
      musicVolume: readMusicVolume(),
      seVolume: readSeVolume(),
    });
    void this.audio.start({ bossLevel: this.bossModeLevel });
  };

  destroy = () => {
    this.active = false;
    this.stopPrescan();
    this.audio?.destroy();
    this.audio = null;
    this.restoreTileFetchBypass?.();
    this.restoreTileFetchBypass = null;
    this.input.stop();
    this.stopViewportListener?.();
    this.stopViewportListener = null;
    this.scanner.destroy();
    this.effectManager.destroy();
    if (this.initialized) this.app.destroy(true, { children: true });
    this.enemyGraphics.destroy();
    this.stageDirector.reset();
    this.enemyManager.reset();
    this.bossController.reset();
    this.bullets.length = 0;
    destroyPlayerBulletPool();
    this.squads.length = 0;
    this.initialized = false;
  };

  setPaused = (paused: boolean) => {
    this.paused = paused;
    this.audio?.setMuted(paused && !this.gameOver);
    if (paused) this.input.setShooting(false);
  };

  getDPadEnabled = () => readDPadEnabled();

  setDPadEnabled = (enabled: boolean) => {
    persistDPadEnabled(enabled);
    this.input.setDPadEnabled(enabled);
  };

  getMusicVolume = () => readMusicVolume();

  setMusicVolume = (volume: number) => {
    const next = persistMusicVolume(volume);
    this.audio?.setMusicVolume(next);
  };

  getSeVolume = () => readSeVolume();

  setSeVolume = (volume: number) => {
    const next = persistSeVolume(volume);
    this.audio?.setSeVolume(next);
  };

  setDebugPanelOpen = (open: boolean) => {
    this.debugPanelOpen = open;
  };

  getStageModuleIds = () => this.stageDirector.getModuleIds();

  getLevelWaveOptions = (level: number) =>
    this.stageDirector.getDebugWaveOptions(level);

  forceNextModule = (moduleId: string) =>
    this.stageDirector.forceNextModule(moduleId);

  // debug: モジュール選択で即時スポーン（既存敵をクリアしてから展開）
  runModule = (moduleId: string) => {
    if (!this.initialized) return;
    this.debugClearEnemies();
    this.spawner.debugSpawnModule(moduleId, this.gameTime);
  };

  runLevelWave = (level: number, waveIndex: number) => {
    if (!this.initialized) return;
    this.debugClearEnemies();
    this.spawner.debugSpawnLevelWave(level, waveIndex, this.gameTime);
  };

  getBossBulletPatternIds = () =>
    ART_CRUISE_BULLET_PATTERN_IDS.filter((id) => id !== "none");

  // debug: 指定弾幕パターンを撃つテスト敵を配置
  debugSpawnBulletPattern = (
    bulletPattern: ArtCruiseDebugSpawnOptions["bulletPattern"],
    level = 1,
    bulletTuning?: ArtCruiseDebugSpawnOptions["bulletTuning"],
  ) => {
    if (!this.initialized) return;
    this.spawner.debugSpawnBulletPattern(
      bulletPattern,
      this.gameTime,
      level,
      bulletTuning,
    );
  };

  debugSpawnBossLevel = (
    level: number,
    options?: ArtCruiseDebugBossOptions,
  ) => {
    if (!this.initialized) return;
    this.spawner.debugSpawnBossLevel(level, this.gameTime, options);
  };

  debugAdvanceBossPhase = () => {
    if (!this.initialized) return;

    const index = this.enemyManager.activeEnemies.findIndex(
      (enemy) => enemy.config.rank === "boss",
    );
    const enemy = this.enemyManager.activeEnemies[index];
    if (!enemy) return;

    const now = this.gameTime;
    const x = enemy.view.x;
    const y = enemy.view.y;
    const damageResult = enemy.takeDamage(enemy.hp);

    if (damageResult.phaseChanged) {
      this.handleBossPhaseChanged(enemy, x, y, now);
      return;
    }

    if (!damageResult.defeated) return;

    this.effectManager.spawnEnemyDeath(x, y, now, true);
    this.audio?.playSe("boss-explosion");
    this.handleBossDefeat(now);
    this.enemyManager.removeEnemy(index);
  };

  setShowHitboxes = (enabled: boolean) => {
    if (this.debugGraphics) this.debugGraphics.visible = enabled;
  };

  debugSpawnEnemy = (options: ArtCruiseDebugSpawnOptions) => {
    if (!this.initialized) return;
    this.spawner.debugSpawn(options, this.gameTime);
  };

  debugClearEnemies = () => {
    this.enemyManager.reset();
    this.bossController.reset();
    this.options.onBossHudHide?.();
    this.squads.length = 0;
    for (let i = this.bullets.length - 1; i >= 0; i--)
      removePlayerBullet(this.bullets, i);
  };

  private mount = async () => {
    await this.app.init({
      antialias: false,
      autoDensity: true,
      backgroundAlpha: 0,
      preference: "webgl",
      resolution: this.resolveResolution(),
      resizeTo: this.options.viewport.getFrame() ?? window,
    });
    if (!this.active) {
      this.app.destroy(true);
      return;
    }

    this.initialized = true;
    this.app.canvas.id = CANVAS_ROOT_ID;
    this.app.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 1;
      width: 100%;
      height: 100%;
      touch-action: none;
      image-rendering: pixelated;
    `;

    (this.options.viewport.getFrame() ?? document.body).appendChild(
      this.app.canvas,
    );

    this.app.stage.addChild(this.root);
    this.root.addChild(this.background.view, this.bgLayer.view, this.gameLayer);

    // Scale root to fit the logical resolution
    this.root.scale.set(this.app.screen.width / GAME_LOGICAL_WIDTH);

    this.gameLayer.addChild(this.ship.view);
    // Effect layer は root 直下の最前面（gameLayer の動的 addChild に影響されない）
    this.effectManager.mountLayer();
    // Debug hitbox はエフェクトより更に前面に置く
    if (this.debugGraphics) this.root.addChild(this.debugGraphics);

    this.input.start();
    this.input.setDPadEnabled(readDPadEnabled());

    const syncViewport = () => {
      const rect = this.options.viewport.getRect();
      this.app.renderer.resize(rect.width, rect.height);
      this.root.scale.set(rect.width / GAME_LOGICAL_WIDTH);
      this.effectManager.setViewportArea(rect.width * rect.height);
    };
    syncViewport();
    this.stopViewportListener = this.options.viewport.onChange(syncViewport);

    this.ship.view.position.set(
      GAME_LOGICAL_WIDTH * 0.5,
      GAME_LOGICAL_HEIGHT * ArtCruiseShip.BASE_RATIO,
    );
    this.input.setTarget(this.ship.x, this.ship.y);
    this.bgLayer.load(GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT);
    this.bgLayer.drawOverlay(GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT);
    await preloadFallbackEnemyTextures({
      gallery: this.options.runtime?.enableGalleryFallbackEnemies !== false,
    });
    this.app.ticker.add(this.update);
    if (this.bossModeLevel !== null)
      this.spawner.debugSpawnBossLevel(this.bossModeLevel, this.gameTime);
    else this.effectManager.spawnGameStart(this.gameTime, GAME_BOUNDS);
    console.log("🧑‍🎨 : Art cruise Pixi canvas started");
  };

  private update = (ticker: Ticker) => {
    if (!this.active || this.paused) return;

    const deltaSeconds = Math.min(ticker.deltaMS / 1000, 0.05);
    this.gameTime += deltaSeconds * 1000;
    const frame = this.frame;
    frame.now = this.gameTime;
    frame.deltaSeconds = deltaSeconds;
    const { now, bounds } = frame;

    this.score.update(now);
    // scanner は gameTime ではなく実時間で間引く (pause 復帰後の初回や
    // タイトル画面の待機中でも 7s 間隔で確実にスキャンを走らせる)。
    this.scanner.update(performance.now());
    this.enemyGraphics.update();
    this.background.update(
      deltaSeconds,
      GAME_LOGICAL_WIDTH,
      GAME_LOGICAL_HEIGHT,
    );
    this.bgLayer.update(deltaSeconds, GAME_LOGICAL_WIDTH, GAME_LOGICAL_HEIGHT);

    this.input.updateDirectionalTarget(deltaSeconds);
    this.ship.update(this.input.pointer.x, this.input.pointer.y, now);

    this.updateBullets(frame);
    this.updateSquads(frame);
    this.bossController.update(deltaSeconds, bounds);

    this.playerPos.x = this.ship.x;
    this.playerPos.y = this.ship.y;
    this.enemyManager.update(now, deltaSeconds, bounds, this.playerPos);
    const bulletUpdateStarted = this.options.debug ? performance.now() : 0;
    this.enemyBulletManager.update(now, bounds);
    if (this.options.debug)
      this.debugEnemyBulletUpdateMs += performance.now() - bulletUpdateStarted;
    this.effectManager.update(now, deltaSeconds);

    this.updateEnemyCollisions(now);
    this.updatePlayerHit(now);
    if (now - this.lastScoreNotifyAt >= SCORE_NOTIFY_INTERVAL_MS) {
      this.lastScoreNotifyAt = now;
      this.options.onScoreUpdate?.(this.score.score, this.score.survivalTimeMs);
    }
    this.updateDebugStats(now);
    this.drawDebugHitboxes();
  };

  private updateDebugStats = (now: number) => {
    if (!this.options.debug) {
      this.options.onStageUpdate?.(this.stageDirector.getState());
      return;
    }

    this.debugFrameCount++;
    if (now - this.debugLastSampleAt < 250) return;

    const elapsed = Math.max(1, now - this.debugLastSampleAt);
    const frames = Math.max(1, this.debugFrameCount);
    this.options.onStageUpdate?.({
      ...this.stageDirector.getState(),
      fps: Math.round((frames * 1000) / elapsed),
      enemyBullets: this.enemyBulletManager.activeBulletCount,
      enemyBulletUpdateMs: this.debugEnemyBulletUpdateMs / frames,
    });
    this.debugFrameCount = 0;
    this.debugEnemyBulletUpdateMs = 0;
    this.debugLastSampleAt = now;
  };

  private resetDebugStats = () => {
    this.debugFrameCount = 0;
    this.debugLastSampleAt = 0;
    this.debugEnemyBulletUpdateMs = 0;
  };

  private updateBullets = ({ now, deltaSeconds }: FrameContext) => {
    if (
      !this.ship.isDead &&
      this.input.pointer.shooting &&
      now - this.lastBulletAt >= BULLET_INTERVAL_MS
    ) {
      spawnPlayerBullet(this.ship.x, this.ship.y, this.gameLayer, this.bullets);
      this.audio?.playSe("player-shoot");
      this.lastBulletAt = now;
    }

    updatePlayerBullets(this.bullets, deltaSeconds);
  };

  private updateSquads = ({ now, deltaSeconds }: FrameContext) => {
    for (let i = this.squads.length - 1; i >= 0; i--) {
      const squad = this.squads[i];
      squad.update(now, deltaSeconds);
      if (squad.isDead()) {
        this.squads.splice(i, 1);
      }
    }
  };

  private updateEnemyCollisions = (now: number) => {
    // BOSS 練習モードは通常 wave 進行を止め、指定ボスのみと対峙させる。
    if (!this.debugPanelOpen && this.bossModeLevel === null)
      this.spawner.spawnQueued(now, this.score.survivalTimeMs);

    const enemies = this.enemyManager.activeEnemies;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (!enemy?.view) continue;

      let hitBulletIndex = -1;
      for (let j = 0; j < this.bullets.length; j++) {
        const bullet = this.bullets[j];
        if (!this.setEnemyHitPoint(
          enemy.view,
          enemy.radius,
          bullet.view,
          bullet.halfW,
          bullet.halfH,
        )) continue;
        hitBulletIndex = j;
        break;
      }

      if (hitBulletIndex >= 0) {
        const x = enemy.view.x;
        const y = enemy.view.y;
        removePlayerBullet(this.bullets, hitBulletIndex);
        this.effectManager.spawnHit(
          this.enemyHitPoint.x,
          this.enemyHitPoint.y,
          now,
          true,
        );
        if (enemy.isInvincible(now)) continue;

        this.score.addDamage(enemy.config, Math.min(1, enemy.hp));
        const damageResult = enemy.takeDamage(1, now);
        const isBossEnemy = enemy.config.rank === "boss";
        if (damageResult.phaseChanged) {
          this.handleBossPhaseChanged(enemy, x, y, now);
          continue;
        }

        if (isBossEnemy && !damageResult.defeated)
          this.options.onBossHudUpdate?.(getBossHpRatio(enemy));

        if (damageResult.defeated) {
          const isBoss = enemy.config.rank === "boss";
          this.score.addDefeat(enemy.config);
          this.effectManager.spawnEnemyDeath(x, y, now, isBoss);
          if (isBoss) {
            this.audio?.playSe("boss-explosion");
            this.handleBossDefeat(now);
          }
          this.enemyManager.removeEnemy(i);
        }
      }
    }
  };

  private handleBossDefeat = (now: number) => {
    // クリアタイム = ボス出現〜撃破。撃破した level を解放/ベスト更新する。
    const clearedLevel =
      this.bossModeLevel ?? this.stageDirector.getState().level;
    const timeMs = this.bossSpawnedAt === null ? 0 : now - this.bossSpawnedAt;
    this.bossSpawnedAt = null;
    if (timeMs > 0) recordBossClear(clearedLevel, timeMs);

    if (this.bossModeLevel !== null) {
      // 練習モード: stage を進めず、クリア演出（タイム表示）へ。
      this.effectManager.spawnBulletClearRings(
        this.enemyBulletManager.clearForEnemyDefeat(now),
        now,
      );
      this.options.onBossClear?.(clearedLevel, timeMs);
      return;
    }

    this.ship.addLife();
    this.options.onHpChange?.(this.ship.currentHp);
    this.stageDirector.addBossDefeatLevel();
    this.stageDirector.pauseAfterBossDefeat(now);
    this.effectManager.spawnBulletClearRings(
      this.enemyBulletManager.clearForEnemyDefeat(now),
      now,
    );
  };

  private handleBossPhaseChanged = (
    enemy: ArtCruiseEnemyEntity,
    x: number,
    y: number,
    now: number,
  ) => {
    this.enemyManager.invalidateLauncherOrigins();
    const phaseIndex = enemy.rawData.bossPhaseIndex ?? 0;
    const phaseName = enemy.rawData.bossPhases?.[phaseIndex]?.ultimateName;
    this.options.onBossHudShow?.({
      name: phaseName ?? "BOSS",
      phaseCount: enemy.rawData.bossPhases?.length ?? 1,
      phaseIndex,
      hpRatio: getBossHpRatio(enemy),
    });
    const chargeMs = 2000;
    enemy.startBossCharge(now + chargeMs);
    this.stageDirector.pauseForBossPhaseTransition(now, chargeMs);
    this.playBossPhaseTransition(x, y, now, phaseName);
    this.effectManager.spawnBossPhaseCharge(enemy.view, now, chargeMs);
  };

  private playBossPhaseTransition = (
    x: number,
    y: number,
    now: number,
    phaseName?: string,
  ) => {
    playBossPhaseTransitionEffect(
      {
        effectManager: this.effectManager,
        enemyBulletManager: this.enemyBulletManager,
        audio: this.audio,
        bounds: GAME_BOUNDS,
      },
      x,
      y,
      now,
      phaseName,
    );
  };

  private updatePlayerHit = (now: number) => {
    if (this.ship.isDead || this.ship.isInvincible(now)) return;

    const px = this.ship.x;
    const py = this.ship.y;

    for (const bullet of this.enemyBulletManager.activeBullets) {
      if (now < bullet.bornAt) continue;
      if (!hitTestHittableBullet(bullet, px, py, PLAYER_HIT_RADIUS)) continue;

      const result = this.ship.takeHit(now);
      if (!result.damaged) return;

      this.options.onHpChange?.(this.ship.currentHp);
      this.effectManager.spawnHit(px, py, now);

      if (result.dead) {
        this.audio?.playSe("player-dead");
        this.triggerGameOver(now);
      } else {
        this.audio?.playSe("player-hit");
      }
      return;
    }
  };

  private handleBossSpawn = (
    enemy: ArtCruiseEnemyEntity,
    options: { skipEntrance?: boolean } = {},
  ) => {
    this.bossSpawnedAt = this.gameTime;
    this.bgLayer.setBossActive(true);
    this.audio?.transitionToBoss(this.getCurrentBossLevel());
    enemy.setInvincible(this.gameTime + 4000);
    this.options.onBossHudShow?.({
      name: enemy.rawData.bossPhases?.[0]?.ultimateName ?? "BOSS",
      phaseCount: enemy.rawData.bossPhases?.length ?? 1,
      phaseIndex: enemy.rawData.bossPhaseIndex ?? 0,
      hpRatio: getBossHpRatio(enemy),
    });
    if (options.skipEntrance) {
      this.bossController.startArrival();
      return;
    }

    const texture = this.app.renderer.generateTexture({ target: enemy.view });
    const firstPhaseName = enemy.rawData.bossPhases?.[0]?.ultimateName;
    this.effectManager.spawnBossEntrance(
      texture,
      this.gameTime,
      GAME_BOUNDS,
      () => {
        this.bossController.startArrival();
        if (firstPhaseName) {
          this.effectManager.spawnBossPhaseTransitionWithName(
            GAME_LOGICAL_WIDTH * 0.5,
            GAME_LOGICAL_HEIGHT * 0.25,
            this.gameTime,
            GAME_BOUNDS,
            firstPhaseName,
          );
        }
      },
    );
  };

  private triggerGameOver = (now: number) => {
    if (this.gameOver) return;
    this.gameOver = true;
    this.score.update(now);
    this.input.setShooting(false);
    this.bgLayer.reset();
    this.effectManager.spawnPlayerDeath(this.ship.x, this.ship.y, now);
    this.audio?.playGameOver();
    const { score, survivalTimeMs } = this.score;
    const { level } = this.stageDirector.getState();
    const highScore =
      this.bossModeLevel === null
        ? recordHighScore(score, survivalTimeMs, level)
        : null;
    setTimeout(() => {
      this.options.onGameOver?.(
        score,
        survivalTimeMs,
        level,
        this.continueCount,
        highScore,
      );
    }, 1500);
  };

  private drawDebugHitboxes = () => {
    if (!this.debugGraphics) return;
    renderDebugHitboxes(this.debugGraphics, {
      bullets: this.bullets,
      enemies: this.enemyManager.activeEnemies,
      enemyBullets: this.enemyBulletManager.activeBullets,
    });
  };

  private handleEnemyRemoved = (
    enemy: ArtCruiseEnemyEntity,
    defeated: boolean,
  ) => {
    // 共有 texture の参照を解放。最後の参照が外れた退避済み texture はここで破棄される。
    const assetId = enemy.rawData.dynamicAsset?.id;
    if (assetId) this.enemyGraphics.release(assetId);

    if (enemy.config.rank === "boss") {
      this.bgLayer.setBossActive(false);
      this.bossController.clearBoss(enemy);
      this.options.onBossHudHide?.();
      this.audio?.transitionToStage();
    } else if (defeated) this.audio?.playSe("grunt-down");

    if (enemy.squadId) {
      const squad = this.squads.find((s) => s.id === enemy.squadId);
      squad?.removeMember(enemy.rawData);
    }
  };

  // 同フレームで複数敵が一斉射撃しても SE は 1 発に絞る (80ms throttle)
  private handleEnemyShot = (seId?: ArtCruiseSeId) => {
    if (!seId) return;
    const now = performance.now();
    if (now - this.lastEnemyShotSeAt < 80) return;
    this.lastEnemyShotSeAt = now;
    this.audio?.playSe(seId);
  };

  private getCurrentBossLevel = () =>
    this.bossModeLevel ?? this.stageDirector.getState().level;

  // enemy(中心±halfSize) と player弾(中心±halfW/halfH) の矩形×矩形(AABB)判定。
  // no-hit を早期 return し、hitPoint は再利用オブジェクトへ書く。
  private setEnemyHitPoint = (
    enemy: { x: number; y: number },
    enemyHalfSize: number,
    bullet: { x: number; y: number },
    bulletHalfW: number,
    bulletHalfH: number,
  ): boolean => {
    const enemyX = enemy.x;
    const enemyY = enemy.y;
    const bulletX = bullet.x;
    const bulletY = bullet.y;
    const enemyMinX = enemyX - enemyHalfSize;
    const enemyMaxX = enemyX + enemyHalfSize;
    const bulletMinX = bulletX - bulletHalfW;
    const bulletMaxX = bulletX + bulletHalfW;
    if (enemyMinX > bulletMaxX || enemyMaxX < bulletMinX) return false;

    const enemyMinY = enemyY - enemyHalfSize;
    const enemyMaxY = enemyY + enemyHalfSize;
    const bulletMinY = bulletY - bulletHalfH;
    const bulletMaxY = bulletY + bulletHalfH;
    if (enemyMinY > bulletMaxY || enemyMaxY < bulletMinY) return false;

    this.enemyHitPoint.x =
      (Math.max(enemyMinX, bulletMinX) + Math.min(enemyMaxX, bulletMaxX)) * 0.5;
    this.enemyHitPoint.y =
      (Math.max(enemyMinY, bulletMinY) + Math.min(enemyMaxY, bulletMaxY)) * 0.5;
    return true;
  };

  private unitScale = () => GAME_LOGICAL_WIDTH / 10;

  private resolveResolution = () =>
    resolveResolutionValue(getResolutionLevel());

  getResolutionLevel = () => getResolutionLevel();

  /** Pause menu: change resolution level and apply immediately to the renderer. */
  setResolutionLevel = (level: ResolutionLevel) => {
    setResolutionLevel(level);
    if (!this.initialized) return;
    this.app.renderer.resolution = this.resolveResolution();
    const rect = this.options.viewport.getRect();
    this.app.renderer.resize(rect.width, rect.height);
    this.root.scale.set(rect.width / GAME_LOGICAL_WIDTH);
  };

  getDynamicEnemyMaxSizePx = () => getDynamicEnemyMaxSizePx();

  setDynamicEnemyMaxSizePx = (sizePx: number) => {
    const next = setDynamicEnemyMaxSizePx(sizePx);
    this.scanner.setMaxSizePx(next);
    void refreshGalleryFallbackEnemyTextures({
      gallery: this.options.runtime?.enableGalleryFallbackEnemies !== false,
    });
  };

  getGalleryEnemyFallbackEnabled = () => readGalleryEnemyFallbackEnabled();

  setGalleryEnemyFallbackEnabled = (enabled: boolean) => {
    persistGalleryEnemyFallbackEnabled(enabled);
    void refreshGalleryFallbackEnemyTextures({
      gallery: this.options.runtime?.enableGalleryFallbackEnemies !== false,
    });
  };
}
