import { UI_ROOT_ID, isDebugMode, type ResolutionLevel } from "../constants";
import { ArtCruiseDebugPanel } from "../debug";
import type {
  ArtCruiseDebugBossOptions,
  ArtCruiseDebugSpawnOptions,
} from "../debug";
import type { ArtCruiseDebugWaveOption } from "../stage-director";
import type { ArtCruiseEnemyBulletPatternId } from "../enemy/enemy-rules/types";
import { ArtCruiseTitleScreen } from "../title-screen";
import { ArtCruiseBossSelectScreen } from "../boss-mode/select-screen";
import type { ArtCruiseViewport } from "../viewport";
import { getHighScore, type ArtCruiseHighScoreResult } from "../score";
import { createBossHud } from "./boss-hud";
import { FONT_STACK, formatHp, formatScore, formatTime } from "./format";
import {
  createBossClearModal,
  createGameOverModal,
  createPauseModal,
  createSettingsModal,
} from "./modal";
import { createScoreHudPanel } from "./score-hud";

export type BossHudState = {
  name: string;
  phaseCount: number;
  phaseIndex: number;
  hpRatio: number;
};

const formatMs = (ms: number) => ms.toFixed(ms < 10 ? 2 : 1);

type ArtCruiseUiOptions = {
  viewport: ArtCruiseViewport;
  onStart: () => void;
  onStartBoss: (level: number) => void;
  onRetry: () => void;
  onContinue: () => void;
  onExit: () => void;
  onReturnToTitle: () => void;
  onPauseChange: (paused: boolean) => void;
  onDebugSpawn: (options: ArtCruiseDebugSpawnOptions) => void;
  onDebugClear: () => void;
  onDebugPanelChange: (open: boolean) => void;
  getModuleIds: () => string[];
  onRunModule: (moduleId: string) => void;
  getLevelWaveOptions: (level: number) => ArtCruiseDebugWaveOption[];
  onRunLevelWave: (level: number, waveIndex: number) => void;
  getBossBulletPatternIds: () => ArtCruiseEnemyBulletPatternId[];
  onSpawnBossLevel: (
    level: number,
    options?: ArtCruiseDebugBossOptions,
  ) => void;
  onAdvanceBossPhase: () => void;
  onHitboxToggle: (enabled: boolean) => void;
  getResolutionLevel: () => ResolutionLevel;
  onResolutionChange: (level: ResolutionLevel) => void;
  getDynamicEnemyMaxSizePx: () => number;
  onDynamicEnemyMaxSizeChange: (sizePx: number) => void;
  getGalleryEnemyFallbackEnabled: () => boolean;
  onGalleryEnemyFallbackChange: (enabled: boolean) => void;
  getDPadEnabled: () => boolean;
  onDPadEnabledChange: (enabled: boolean) => void;
  getMusicVolume: () => number;
  onMusicVolumeChange: (volume: number) => void;
  getSeVolume: () => number;
  onSeVolumeChange: (volume: number) => void;
};

export class ArtCruiseUi {
  private root: HTMLDivElement | null = null;
  private modal: HTMLDivElement | null = null;
  private titleScreen: ArtCruiseTitleScreen | null = null;
  private bossSelectScreen: ArtCruiseBossSelectScreen | null = null;
  private bossClearModal: HTMLDivElement | null = null;
  private debugPanel: ArtCruiseDebugPanel | null = null;
  private stageInfoEl: HTMLDivElement | null = null;
  private stopViewportListener: (() => void) | null = null;
  private scoreValueEl: HTMLSpanElement | null = null;
  private highScoreValueEl: HTMLSpanElement | null = null;
  private timeValueEl: HTMLSpanElement | null = null;
  private hpValueEl: HTMLSpanElement | null = null;
  private setScoreHudOrientation: ((o: "column" | "row") => void) | null = null;
  private bossHudEl: HTMLDivElement | null = null;
  private bossHudNameEl: HTMLSpanElement | null = null;
  private bossHudPipsEl: HTMLDivElement | null = null;
  private bossHudBarFillEl: HTMLDivElement | null = null;
  private gameOverModal: HTMLDivElement | null = null;
  private pauseButton: HTMLButtonElement | null = null;
  private lastScore = -1;
  private lastSurvivalSecond = -1;
  private lastHp = -1;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(private readonly options: ArtCruiseUiOptions) {}

  mount = () => {
    if (this.root) return;

    const root = document.createElement("div");
    root.id = UI_ROOT_ID;
    root.style.cssText = `
      position: fixed;
      z-index: 1003;
      pointer-events: auto;
      font-family: ${FONT_STACK};
      display: none;
      padding: 0 10px;
    `;

    const {
      el: scoreHudEl,
      scoreValueEl,
      highScoreValueEl,
      timeValueEl,
      hpValueEl,
      setOrientation,
    } = createScoreHudPanel();
    this.scoreValueEl = scoreValueEl;
    this.highScoreValueEl = highScoreValueEl;
    this.timeValueEl = timeValueEl;
    this.hpValueEl = hpValueEl;
    this.setScoreHudOrientation = setOrientation;

    const escapeButton = document.createElement("button");
    escapeButton.type = "button";
    escapeButton.textContent = "Esc";
    escapeButton.title = "Pause Art Cruise";
    escapeButton.style.cssText = `
      position: fixed;
      left: 8px;
      top: 8px;
      z-index: 1003;
      padding: 2px 5px;
      border: 0;
      border-radius: 3px;
      background: rgba(2, 6, 23, 0.38);
      color: rgba(224, 250, 255, 0.58);
      font-family: ${FONT_STACK};
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.2px;
      text-shadow: 0 0 8px rgba(2, 6, 23, 0.9);
      cursor: pointer;
      display: none;
    `;
    escapeButton.addEventListener("pointerenter", () => {
      escapeButton.style.color = "rgba(224, 250, 255, 0.82)";
      escapeButton.style.background = "rgba(2, 6, 23, 0.54)";
    });
    escapeButton.addEventListener("pointerleave", () => {
      escapeButton.style.color = "rgba(224, 250, 255, 0.58)";
      escapeButton.style.background = "rgba(2, 6, 23, 0.38)";
    });
    escapeButton.addEventListener("click", this.openExitModal);
    document.body.appendChild(escapeButton);
    this.pauseButton = escapeButton;

    const debug = isDebugMode();

    const debugButton = document.createElement("button");
    debugButton.type = "button";
    debugButton.textContent = "DEBUG";
    debugButton.title = "Open Art Cruise debug menu";
    debugButton.style.cssText = `
      display: ${debug ? "inline-block" : "none"};
      min-width: 56px;
      height: 36px;
      border: 1px solid rgba(103, 232, 249, 0.72);
      border-bottom-color: rgba(244, 114, 182, 0.72);
      border-radius: 4px;
      background: linear-gradient(180deg, rgba(8, 47, 73, 0.92), rgba(12, 74, 110, 0.86));
      color: #e0faff;
      box-shadow:
        0 0 0 1px rgba(2, 6, 23, 0.9),
        inset 0 0 12px rgba(34, 211, 238, 0.16);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.8px;
      cursor: pointer;
    `;

    const stageInfoEl = document.createElement("div");
    stageInfoEl.style.cssText = `
      display: ${debug ? "block" : "none"};
      margin-bottom: 6px;
      padding: 4px 8px;
      border: 1px solid rgba(103, 232, 249, 0.35);
      border-radius: 4px;
      background: rgba(2, 6, 23, 0.82);
      color: rgba(103, 232, 249, 0.9);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.7px;
      font-family: monospace;
      pointer-events: none;
    `;
    stageInfoEl.textContent = "LV — BOSS —/— —";
    this.stageInfoEl = stageInfoEl;

    root.append(scoreHudEl, stageInfoEl, debugButton);
    document.body.appendChild(root);
    this.root = root;

    const bossHud = createBossHud();
    this.bossHudEl = bossHud.el;
    this.bossHudNameEl = bossHud.nameEl;
    this.bossHudPipsEl = bossHud.phasePipsEl;
    this.bossHudBarFillEl = bossHud.barFillEl;
    document.body.appendChild(bossHud.el);

    this.debugPanel = new ArtCruiseDebugPanel({
      onSpawn: this.options.onDebugSpawn,
      onClear: this.options.onDebugClear,
      onOpenChange: this.options.onDebugPanelChange,
      getModuleIds: this.options.getModuleIds,
      onRunModule: this.options.onRunModule,
      getLevelWaveOptions: this.options.getLevelWaveOptions,
      onRunLevelWave: this.options.onRunLevelWave,
      getBossBulletPatternIds: this.options.getBossBulletPatternIds,
      onSpawnBossLevel: this.options.onSpawnBossLevel,
      onAdvanceBossPhase: this.options.onAdvanceBossPhase,
      onHitboxToggle: this.options.onHitboxToggle,
    });
    debugButton.addEventListener("click", this.debugPanel.toggle);

    this.titleScreen = new ArtCruiseTitleScreen({
      fontStack: FONT_STACK,
      onStart: this.startGame,
      onBossMode: this.openBossSelect,
      onSettings: this.openTitleSettings,
      onExit: this.options.onExit,
    });
    this.titleScreen.mount();
    this.updateHighScore(getHighScore()?.score ?? 0);

    this.layoutRoot();
    this.stopViewportListener = this.options.viewport.onChange(this.layoutRoot);
  };

  updateScore = (score: number, survivalMs: number) => {
    const nextScore = Math.floor(score);
    const nextSecond = Math.floor(survivalMs / 1000);

    if (this.lastScore !== nextScore) {
      if (this.scoreValueEl)
        this.scoreValueEl.textContent = formatScore(nextScore);
      this.lastScore = nextScore;
    }
    if (this.lastSurvivalSecond !== nextSecond) {
      if (this.timeValueEl)
        this.timeValueEl.textContent = formatTime(survivalMs);
      this.lastSurvivalSecond = nextSecond;
    }
  };

  updateHp = (hp: number) => {
    if (this.lastHp === hp) return;
    this.lastHp = hp;
    if (this.hpValueEl) this.hpValueEl.textContent = formatHp(hp);
  };

  private updateHighScore = (score: number) => {
    if (this.highScoreValueEl)
      this.highScoreValueEl.textContent = formatScore(score);
  };

  updateDebugState = (state: {
    level: number;
    sinceBoss: number;
    requiredWavesBeforeBoss: number;
    lastModuleId: string;
    fps?: number;
    enemyBullets?: number;
    enemyBulletUpdateMs?: number;
  }) => {
    if (!this.stageInfoEl) return;
    const perf =
      state.fps === undefined
        ? ""
        : `  FPS ${state.fps}  EB ${state.enemyBullets ?? 0}  ${formatMs(state.enemyBulletUpdateMs ?? 0)}ms`;
    this.stageInfoEl.textContent = `LV ${state.level}  BOSS ${state.sinceBoss}/${state.requiredWavesBeforeBoss}  ${state.lastModuleId || "—"}${perf}`;
  };

  showGameOver = (
    score: number,
    survivalMs: number,
    level: number,
    continueCount: number,
    highScore: ArtCruiseHighScoreResult | null,
  ) => {
    if (this.gameOverModal) return;

    this.gameOverModal = createGameOverModal({
      score,
      survivalMs,
      level,
      continueCount,
      highScore,
      onReady: () => this.options.onPauseChange(true),
      onContinue: () => {
        this.closeGameOver();
        this.options.onContinue();
      },
      onRetry: () => {
        this.closeGameOver();
        this.options.onRetry();
      },
      onExit: this.options.onExit,
    });
    if (highScore) this.updateHighScore(highScore.score);
  };

  private closeGameOver = () => {
    this.gameOverModal?.remove();
    this.gameOverModal = null;
    this.options.onPauseChange(false);
  };

  destroy = () => {
    this.closeModal(false);
    this.gameOverModal?.remove();
    this.gameOverModal = null;
    this.bossClearModal?.remove();
    this.bossClearModal = null;
    this.bossSelectScreen?.destroy();
    this.bossSelectScreen = null;
    this.titleScreen?.destroy();
    this.titleScreen = null;
    if (this.debugPanel?.isOpen) this.options.onDebugPanelChange(false);
    this.stopViewportListener?.();
    this.stopViewportListener = null;
    this.debugPanel = null;
    this.scoreValueEl = null;
    this.highScoreValueEl = null;
    this.timeValueEl = null;
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler);
      this.keydownHandler = null;
    }
    this.bossHudEl?.remove();
    this.bossHudEl = null;
    this.bossHudNameEl = null;
    this.bossHudPipsEl = null;
    this.bossHudBarFillEl = null;
    this.pauseButton?.remove();
    this.pauseButton = null;
    this.root?.remove();
    this.root = null;
  };

  private startGame = () => {
    this.enterGameHud();
    this.options.onStart();
  };

  private openBossSelect = () => {
    if (this.bossSelectScreen) return;
    this.titleScreen?.destroy();
    this.titleScreen = null;
    this.bossSelectScreen = new ArtCruiseBossSelectScreen({
      fontStack: FONT_STACK,
      onSelect: this.startBossGame,
      onBack: this.backToTitle,
    });
    this.bossSelectScreen.mount();
  };

  private backToTitle = () => {
    this.bossSelectScreen?.destroy();
    this.bossSelectScreen = null;
    this.titleScreen = new ArtCruiseTitleScreen({
      fontStack: FONT_STACK,
      onStart: this.startGame,
      onBossMode: this.openBossSelect,
      onSettings: this.openTitleSettings,
      onExit: this.options.onExit,
    });
    this.titleScreen.mount();
  };

  private openTitleSettings = () => {
    if (this.modal) return;
    this.modal = createSettingsModal({
      onClose: () => this.closeModal(false),
      resolutionLevel: this.options.getResolutionLevel(),
      onResolutionChange: this.options.onResolutionChange,
      dynamicEnemyMaxSizePx: this.options.getDynamicEnemyMaxSizePx(),
      onDynamicEnemyMaxSizeChange: this.options.onDynamicEnemyMaxSizeChange,
      galleryEnemyFallbackEnabled:
        this.options.getGalleryEnemyFallbackEnabled(),
      onGalleryEnemyFallbackChange:
        this.options.onGalleryEnemyFallbackChange,
      dPadEnabled: this.options.getDPadEnabled(),
      onDPadEnabledChange: this.options.onDPadEnabledChange,
      musicVolume: this.options.getMusicVolume(),
      onMusicVolumeChange: this.options.onMusicVolumeChange,
      seVolume: this.options.getSeVolume(),
      onSeVolumeChange: this.options.onSeVolumeChange,
    });
  };

  private startBossGame = (level: number) => {
    this.bossSelectScreen?.destroy();
    this.bossSelectScreen = null;
    this.enterGameHud();
    this.options.onStartBoss(level);
  };

  // タイトル/選択画面からゲーム HUD へ遷移する共通処理。
  private enterGameHud = () => {
    this.titleScreen?.destroy();
    this.titleScreen = null;
    if (this.root) this.root.style.display = "";
    if (this.pauseButton) this.pauseButton.style.display = "";
    this.layoutRoot();
    if (this.keydownHandler) return;
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (this.gameOverModal || this.bossClearModal) return;
      if (this.modal) this.closeModal(true);
      else this.openExitModal();
    };
    document.addEventListener("keydown", this.keydownHandler);
  };

  showBossClear = (level: number, timeMs: number) => {
    if (this.bossClearModal) return;
    this.bossClearModal = createBossClearModal({
      level,
      timeMs,
      onReady: () => this.options.onPauseChange(true),
      onRetry: () => {
        this.closeBossClear();
        this.options.onRetry();
      },
      onExit: this.options.onExit,
    });
  };

  private closeBossClear = (resume = true) => {
    this.bossClearModal?.remove();
    this.bossClearModal = null;
    if (resume) this.options.onPauseChange(false);
  };

  private layoutRoot = () => {
    if (!this.root) return;

    const rect = this.options.viewport.getRect();
    const gap = 12;
    const width = 144;
    const rightLeft = rect.right + gap;
    // 右側に縦並びHUDが収まるかどうかで配置モードを決定する。
    const fitsRight = rightLeft + width + gap <= window.innerWidth;

    if (fitsRight) {
      // 横長: プレイエリア右側に縦並び配置。
      this.setScoreHudOrientation?.("column");
      this.root.style.padding = "0 10px";
      this.root.style.left = `${Math.max(gap, rightLeft)}px`;
      this.root.style.right = "";
      this.root.style.top = `${Math.max(gap, rect.top)}px`;
      this.layoutPauseButton(8, 8);
    } else {
      // 縦長(モバイル等): プレイエリア上端の外側に横並び配置。
      // 上に収まらなければエリア内上端へフォールバック。
      this.setScoreHudOrientation?.("row");
      const margin = 8;
      const above = rect.top - margin;
      const top = above >= gap + 56 ? gap : rect.top + margin;
      this.root.style.padding = "0";
      this.root.style.left = `${rect.left}px`;
      this.root.style.right = `${window.innerWidth - rect.right}px`;
      this.root.style.top = `${top}px`;
      this.layoutPauseButton(rect.left + margin, rect.top + margin);
    }

    this.layoutBossHud(rect);
  };

  private layoutPauseButton = (left: number, top: number) => {
    if (!this.pauseButton) return;
    this.pauseButton.style.left = `${left}px`;
    this.pauseButton.style.top = `${top}px`;
  };

  private layoutBossHud = (rect: DOMRect) => {
    if (!this.bossHudEl) return;
    const margin = 8;
    const height = 40;
    const left = rect.left + margin;
    const width = Math.max(120, rect.width - margin * 2);
    // playエリア上端の外側に配置。上に収まらなければエリア内上端へフォールバック。
    const above = rect.top - height - margin;
    const top = above >= 8 ? above : rect.top + margin;
    this.bossHudEl.style.left = `${left}px`;
    this.bossHudEl.style.top = `${top}px`;
    this.bossHudEl.style.width = `${width}px`;
  };

  showBossHud = (state: BossHudState) => {
    if (!this.bossHudEl) return;
    this.bossHudEl.style.display = "flex";
    this.renderBossPips(state.phaseCount, state.phaseIndex);
    if (this.bossHudNameEl) this.bossHudNameEl.textContent = state.name;
    this.updateBossHud(state.hpRatio);
  };

  updateBossHud = (
    hpRatio: number,
    phaseIndex?: number,
    phaseCount?: number,
  ) => {
    if (this.bossHudBarFillEl)
      this.bossHudBarFillEl.style.transform = `scaleX(${Math.max(0, Math.min(1, hpRatio))})`;
    if (phaseIndex !== undefined && phaseCount !== undefined)
      this.renderBossPips(phaseCount, phaseIndex);
  };

  hideBossHud = () => {
    if (this.bossHudEl) this.bossHudEl.style.display = "none";
  };

  private renderBossPips = (phaseCount: number, phaseIndex: number) => {
    const pips = this.bossHudPipsEl;
    if (!pips) return;
    pips.replaceChildren();
    for (let i = 0; i < phaseCount; i++) {
      const pip = document.createElement("span");
      const active = i >= phaseIndex;
      pip.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${active ? "rgba(244,63,94,0.95)" : "rgba(120,30,40,0.4)"};
        box-shadow: ${active ? "0 0 6px rgba(244,63,94,0.9)" : "none"};
      `;
      pips.appendChild(pip);
    }
  };

  private openExitModal = () => {
    if (this.modal) return;

    this.options.onPauseChange(true);

    this.modal = createPauseModal({
      onResume: () => this.closeModal(true),
      onSettings: this.routePauseToSettings,
      onReturnToTitle: this.returnToTitle,
      onExit: this.options.onExit,
    });
  };

  private returnToTitle = () => {
    this.closeModal(false);
    this.options.onReturnToTitle();
  };

  private routePauseToSettings = () => {
    this.modal?.remove();
    this.modal = createSettingsModal({
      onClose: () => this.closeModal(true),
      resolutionLevel: this.options.getResolutionLevel(),
      onResolutionChange: this.options.onResolutionChange,
      dynamicEnemyMaxSizePx: this.options.getDynamicEnemyMaxSizePx(),
      onDynamicEnemyMaxSizeChange: this.options.onDynamicEnemyMaxSizeChange,
      galleryEnemyFallbackEnabled:
        this.options.getGalleryEnemyFallbackEnabled(),
      onGalleryEnemyFallbackChange:
        this.options.onGalleryEnemyFallbackChange,
      dPadEnabled: this.options.getDPadEnabled(),
      onDPadEnabledChange: this.options.onDPadEnabledChange,
      musicVolume: this.options.getMusicVolume(),
      onMusicVolumeChange: this.options.onMusicVolumeChange,
      seVolume: this.options.getSeVolume(),
      onSeVolumeChange: this.options.onSeVolumeChange,
    });
  };

  private closeModal = (resume: boolean) => {
    this.modal?.remove();
    this.modal = null;
    if (resume) this.options.onPauseChange(false);
  };
}
