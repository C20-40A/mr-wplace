import { ArtCruiseGameLoop } from "./game-loop";
import { ArtCruiseMapViewEffects } from "./map-view-effects";
import type { ArtCruiseSceneOptions } from "./types";
import { ArtCruiseUi } from "./ui";
import { ArtCruiseViewport } from "./viewport";

export class ArtCruiseScene {
  private readonly game: ArtCruiseGameLoop;
  private readonly viewEffects: ArtCruiseMapViewEffects;
  private readonly viewport: ArtCruiseViewport;
  private readonly ui: ArtCruiseUi;
  private paused = false;
  private started = false;
  private gameStarted = false;
  // BOSS 練習モードで挑戦中の level。null は通常モード。
  private bossModeLevel: number | null = null;
  private autoPausedByBackground = false;

  constructor(private readonly options: ArtCruiseSceneOptions) {
    this.viewport = new ArtCruiseViewport(options.map, options.viewportConfig);
    this.game = new ArtCruiseGameLoop({
      map: options.map,
      viewport: this.viewport,
      audioUrls: options.audioUrls,
      mandalaUrls: options.mandalaUrls,
      debug: options.debug,
      onScoreUpdate: (score, survivalMs) => this.ui.updateScore(score, survivalMs),
      onHpChange: (hp) => this.ui.updateHp(hp),
      onGameOver: (score, survivalMs, level, continueCount, highScore) =>
        this.ui.showGameOver(score, survivalMs, level, continueCount, highScore),
      onBossClear: (level, timeMs) => this.ui.showBossClear(level, timeMs),
      onStageUpdate: (state) => this.ui.updateDebugState(state),
      onBossHudShow: (state) => this.ui.showBossHud(state),
      onBossHudUpdate: (hpRatio, phaseIndex, phaseCount) =>
        this.ui.updateBossHud(hpRatio, phaseIndex, phaseCount),
      onBossHudHide: () => this.ui.hideBossHud(),
    });
    this.viewEffects = new ArtCruiseMapViewEffects(options.map);
    this.ui = new ArtCruiseUi({
      viewport: this.viewport,
      onStart: this.startGame,
      onStartBoss: this.startBossGame,
      onRetry: this.retryGame,
      onContinue: this.continueGame,
      onExit: () => this.options.onExit?.(),
      onPauseChange: this.setPaused,
      onDebugSpawn: this.game.debugSpawnEnemy,
      onDebugClear: this.game.debugClearEnemies,
      onDebugPanelChange: this.game.setDebugPanelOpen,
      getModuleIds: this.game.getStageModuleIds,
      onRunModule: this.game.runModule,
      getLevelWaveOptions: this.game.getLevelWaveOptions,
      onRunLevelWave: this.game.runLevelWave,
      getBossBulletPatternIds: this.game.getBossBulletPatternIds,
      onSpawnBossLevel: this.game.debugSpawnBossLevel,
      onAdvanceBossPhase: this.game.debugAdvanceBossPhase,
      onHitboxToggle: this.game.setShowHitboxes,
      getResolutionLevel: this.game.getResolutionLevel,
      onResolutionChange: this.game.setResolutionLevel,
      getDynamicEnemyMaxSizePx: this.game.getDynamicEnemyMaxSizePx,
      onDynamicEnemyMaxSizeChange: this.game.setDynamicEnemyMaxSizePx,
      getDPadEnabled: this.game.getDPadEnabled,
      onDPadEnabledChange: this.game.setDPadEnabled,
      getMusicVolume: this.game.getMusicVolume,
      onMusicVolumeChange: this.game.setMusicVolume,
      getSeVolume: this.game.getSeVolume,
      onSeVolumeChange: this.game.setSeVolume,
    });
  }

  start = () => {
    if (this.started) return;

    this.started = true;
    this.viewport.mount();
    this.viewEffects.apply();
    this.ui.mount();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.pauseForBackground);
    window.addEventListener("blur", this.pauseForBackground);
    window.addEventListener("focus", this.resumeFromBackground);
    // タイトル画面のうちに敵グラフィックを先読みし、初手の fallback を抑制する。
    this.game.startPrescan();
    console.log("🧑‍🎨 : Art cruise title screen started");
  };

  destroy = () => {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("pagehide", this.pauseForBackground);
    window.removeEventListener("blur", this.pauseForBackground);
    window.removeEventListener("focus", this.resumeFromBackground);
    this.game.destroy();
    this.ui.destroy();
    this.viewEffects.restore();
    this.viewport.destroy();
    this.started = false;
    this.gameStarted = false;
    console.log("🧑‍🎨 : Art cruise scene destroyed");
  };

  private startGame = () => {
    if (this.gameStarted) return;

    this.gameStarted = true;
    this.bossModeLevel = null;
    this.options.onGameStart?.();
    this.game.start();
    console.log("🧑‍🎨 : Art cruise Pixi game started");
  };

  private startBossGame = (level: number) => {
    if (this.gameStarted) return;

    this.gameStarted = true;
    this.bossModeLevel = level;
    this.options.onGameStart?.();
    this.game.start({ bossLevel: level });
    console.log("🧑‍🎨 : Art cruise boss practice started:", level);
  };

  private retryGame = () => {
    this.game.restart();
    console.log("🧑‍🎨 : Art cruise Pixi game restarted");
  };

  private continueGame = () => {
    this.game.continueGame();
    console.log("🧑‍🎨 : Art cruise Pixi game continued");
  };

  /** ボス出現時に boss BGM へ crossfade（呼び出し配線は今後） */
  transitionToBossBgm = () => this.game.transitionToBossBgm();

  setPaused = (paused: boolean) => {
    if (this.paused === paused) return;
    this.paused = paused;
    this.game.setPaused(paused);
    this.options.onPauseChange?.(paused);
    console.log("🧑‍🎨 : Art cruise pause:", paused);
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.pauseForBackground();
      return;
    }

    this.resumeFromBackground();
  };

  private pauseForBackground = () => {
    if (this.paused) return;

    this.autoPausedByBackground = true;
    this.setPaused(true);
  };

  private resumeFromBackground = () => {
    if (!this.autoPausedByBackground) return;

    this.autoPausedByBackground = false;
    this.setPaused(false);
  };
}
