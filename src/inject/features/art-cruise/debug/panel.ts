import { SHOW_HITBOXES_STORAGE_KEY } from "../constants";
import type {
  ArtCruiseAbyssalUpdraftConfig,
  ArtCruiseBulletPatternTuning,
  ArtCruiseBurstBulletArt,
  ArtCruiseBurstConfig,
  ArtCruiseDenseRingConfig,
  ArtCruiseEdgeBarrageConfig,
  ArtCruiseEdgeBeamConfig,
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseFlappyGateConfig,
  ArtCruiseReflectLaserConfig,
} from "../enemy/enemy-rules/types";
import type { ArtCruiseDebugWaveOption } from "../stage-director";
import type {
  ArtCruiseDebugBossOptions,
  ArtCruiseDebugSpawnOptions,
} from "./types";

type DebugPanelOptions = {
  onSpawn: (options: ArtCruiseDebugSpawnOptions) => void;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
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
};

type PatternTuningInput = {
  wrapper: HTMLElement;
  read: (tuning: ArtCruiseBulletPatternTuning) => void;
};

type EdgeBarrageTuningKey = "sideKunai" | "topIce";

type EdgeBarrageNumberKey = {
  [K in keyof ArtCruiseEdgeBarrageConfig]: ArtCruiseEdgeBarrageConfig[K] extends
    | number
    | undefined
    ? K
    : never;
}[keyof ArtCruiseEdgeBarrageConfig] & string;

type BurstNumberKey = {
  [K in keyof ArtCruiseBurstConfig]: ArtCruiseBurstConfig[K] extends
    | number
    | undefined
    ? K
    : never;
}[keyof ArtCruiseBurstConfig] & string;

type DenseRingNumberKey = {
  [K in keyof ArtCruiseDenseRingConfig]:
    ArtCruiseDenseRingConfig[K] extends number | undefined ? K : never;
}[keyof ArtCruiseDenseRingConfig] & string;

type EdgeBeamNumberKey = {
  [K in keyof ArtCruiseEdgeBeamConfig]: ArtCruiseEdgeBeamConfig[K] extends
    | number
    | undefined
    ? K
    : never;
}[keyof ArtCruiseEdgeBeamConfig] & string;

type AbyssalUpdraftNumberKey = {
  [K in keyof ArtCruiseAbyssalUpdraftConfig]:
    ArtCruiseAbyssalUpdraftConfig[K] extends number | undefined ? K : never;
}[keyof ArtCruiseAbyssalUpdraftConfig] & string;

type FlappyGateNumberKey = {
  [K in keyof ArtCruiseFlappyGateConfig]:
    ArtCruiseFlappyGateConfig[K] extends number | undefined ? K : never;
}[keyof ArtCruiseFlappyGateConfig] & string;

type ReflectLaserNumberKey = {
  [K in keyof ArtCruiseReflectLaserConfig]:
    ArtCruiseReflectLaserConfig[K] extends number | undefined ? K : never;
}[keyof ArtCruiseReflectLaserConfig] & string;

type PatternNumberField<Key extends string> = {
  label: string;
  key: Key;
  step: string;
  title: string;
};

const EDGE_BARRAGE_NUMBER_FIELDS: {
  label: string;
  key: EdgeBarrageNumberKey;
  step: string;
  title: string;
}[] = [
  {
    label: "gap",
    key: "turretGapPx",
    step: "1",
    title: "Kunai turret gap px",
  },
  {
    label: "wave",
    key: "bulletsPerWave",
    step: "1",
    title: "Kunai bullets per wave",
  },
  {
    label: "step",
    key: "delayStepMs",
    step: "1",
    title: "Kunai delay step ms",
  },
  {
    label: "rnd ms",
    key: "randomDelayMs",
    step: "1",
    title: "Kunai random delay ms",
  },
  {
    label: "spread",
    key: "spreadRad",
    step: "0.01",
    title: "Kunai spread rad",
  },
  {
    label: "base spd",
    key: "baseSpeed",
    step: "0.05",
    title: "Kunai base speed",
  },
  {
    label: "accel",
    key: "accel",
    step: "0.05",
    title: "Kunai accel",
  },
];

const BURST_NUMBER_FIELDS: PatternNumberField<BurstNumberKey>[] = [
  {
    label: "spread",
    key: "spreadRad",
    step: "0.01",
    title: "Burst spread rad",
  },
  {
    label: "count",
    key: "bulletCount",
    step: "1",
    title: "Burst bullet count",
  },
  {
    label: "size",
    key: "bulletSize",
    step: "0.5",
    title: "Burst bullet size",
  },
  {
    label: "base spd",
    key: "baseSpeed",
    step: "0.05",
    title: "Burst base speed",
  },
  {
    label: "spd step",
    key: "speedStep",
    step: "0.05",
    title: "Burst speed step",
  },
  {
    label: "accel",
    key: "accel",
    step: "0.05",
    title: "Burst accel",
  },
  {
    label: "min spd",
    key: "minSpeed",
    step: "0.05",
    title: "Burst min speed",
  },
  {
    label: "jitter",
    key: "angleJitterRad",
    step: "0.01",
    title: "Burst angle jitter rad",
  },
  {
    label: "repeat",
    key: "repeatCount",
    step: "1",
    title: "Burst repeat count",
  },
  {
    label: "rep ms",
    key: "repeatDelayMs",
    step: "1",
    title: "Burst repeat delay ms",
  },
  {
    label: "step ms",
    key: "delayStepMs",
    step: "1",
    title: "Burst delay step ms",
  },
];

const DENSE_RING_NUMBER_FIELDS: PatternNumberField<DenseRingNumberKey>[] = [
  {
    label: "fire",
    key: "fireSlots",
    step: "1",
    title: "Dense ring active fire slots",
  },
  {
    label: "cycle",
    key: "cycleSlots",
    step: "1",
    title: "Dense ring total cycle slots",
  },
  {
    label: "slot ms",
    key: "slotMs",
    step: "20",
    title: "Dense ring slot duration ms",
  },
  {
    label: "count",
    key: "count",
    step: "1",
    title: "Dense ring bullets per ring",
  },
  {
    label: "phase ms",
    key: "phaseMs",
    step: "20",
    title: "Dense ring phase cycle ms",
  },
  {
    label: "phase st",
    key: "phaseStepRad",
    step: "0.01",
    title: "Dense ring phase step rad",
  },
  {
    label: "base spd",
    key: "baseSpeed",
    step: "0.05",
    title: "Dense ring base speed",
  },
  {
    label: "alt spd",
    key: "altSpeedAdd",
    step: "0.05",
    title: "Dense ring alternating speed add",
  },
  {
    label: "size",
    key: "bulletSize",
    step: "0.5",
    title: "Dense ring bullet size",
  },
  {
    label: "delay",
    key: "delayMs",
    step: "20",
    title: "Dense ring bullet delay ms",
  },
];

const EDGE_BEAM_NUMBER_FIELDS: PatternNumberField<EdgeBeamNumberKey>[] = [
  {
    label: "count",
    key: "beamCount",
    step: "1",
    title: "Edge beam turret count",
  },
  {
    label: "per",
    key: "beamsPerTurret",
    step: "1",
    title: "Edge beam beams per turret",
  },
  {
    label: "fixed",
    key: "fixedAngle",
    step: "0.05",
    title: "Edge beam fixed angle rad",
  },
  {
    label: "warn",
    key: "warningMs",
    step: "20",
    title: "Edge beam warning ms",
  },
  {
    label: "life",
    key: "lifeMs",
    step: "20",
    title: "Edge beam life ms",
  },
  {
    label: "step",
    key: "delayStepMs",
    step: "20",
    title: "Edge beam delay step ms",
  },
  {
    label: "spread",
    key: "spreadRad",
    step: "0.01",
    title: "Edge beam spread rad",
  },
];

const ABYSSAL_UPDRAFT_NUMBER_FIELDS: PatternNumberField<
  AbyssalUpdraftNumberKey
>[] = [
  {
    label: "spread",
    key: "spreadRad",
    step: "0.01",
    title: "Abyssal updraft spread rad",
  },
];

const FLAPPY_GATE_NUMBER_FIELDS: PatternNumberField<FlappyGateNumberKey>[] = [
  {
    label: "count",
    key: "gateCount",
    step: "1",
    title: "Flappy gate count",
  },
  {
    label: "gap",
    key: "gapSize",
    step: "1",
    title: "Flappy gate gap size px",
  },
  {
    label: "thick",
    key: "thickness",
    step: "1",
    title: "Flappy gate wall thickness px",
  },
  {
    label: "speed",
    key: "baseSpeed",
    step: "0.05",
    title: "Flappy gate speed",
  },
  {
    label: "step",
    key: "delayStepMs",
    step: "20",
    title: "Flappy gate delay between gates ms",
  },
  {
    label: "life",
    key: "lifeMs",
    step: "20",
    title: "Flappy gate life ms",
  },
  {
    label: "jitter",
    key: "gapJitterPx",
    step: "1",
    title: "Flappy gate gap jitter px",
  },
  {
    label: "min mv",
    key: "gapMoveMinPx",
    step: "1",
    title: "Flappy gate minimum gap movement px",
  },
  {
    label: "max mv",
    key: "gapMoveMaxPx",
    step: "1",
    title: "Flappy gate maximum gap movement px",
  },
];

const REFLECT_LASER_NUMBER_FIELDS: PatternNumberField<
  ReflectLaserNumberKey
>[] = [
  {
    label: "count",
    key: "count",
    step: "1",
    title: "Reflect laser count, ignored when offsets is set",
  },
  {
    label: "weave",
    key: "weaveRad",
    step: "0.01",
    title: "Reflect laser weave rad",
  },
  {
    label: "w ms",
    key: "weaveMs",
    step: "20",
    title: "Reflect laser weave cycle ms",
  },
  {
    label: "base spd",
    key: "baseSpeed",
    step: "0.05",
    title: "Reflect laser base speed",
  },
  {
    label: "alt spd",
    key: "altSpeedAdd",
    step: "0.05",
    title: "Reflect laser alternating speed add",
  },
  {
    label: "size",
    key: "bulletSize",
    step: "0.5",
    title: "Reflect laser bullet size",
  },
  {
    label: "step",
    key: "delayStepMs",
    step: "20",
    title: "Reflect laser delay step ms",
  },
  {
    label: "life",
    key: "lifeMs",
    step: "100",
    title: "Reflect laser life ms",
  },
  {
    label: "len",
    key: "length",
    step: "4",
    title: "Reflect laser length",
  },
  {
    label: "trail",
    key: "trailMs",
    step: "20",
    title: "Reflect laser trail ms",
  },
];

export class ArtCruiseDebugPanel {
  private panel: HTMLDivElement | null = null;

  constructor(private readonly options: DebugPanelOptions) {}

  get isOpen() {
    return this.panel !== null;
  }

  toggle = () => {
    if (this.panel) {
      this.close();
    } else {
      this.open();
    }
  };

  close = () => {
    if (!this.panel) return;
    this.panel.remove();
    this.panel = null;
    this.options.onOpenChange(false);
  };

  private open = () => {
    const panel = document.createElement("div");
    panel.style.cssText = `
      position: fixed;
      left: 8px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1010;
      width: 260px;
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px;
      border: 1px solid rgba(103, 232, 249, 0.72);
      border-bottom-color: rgba(244, 114, 182, 0.72);
      border-radius: 4px;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.96)),
        repeating-linear-gradient(0deg, transparent 0 4px, rgba(103, 232, 249, 0.1) 4px 5px);
      box-shadow:
        0 0 0 1px rgba(2, 6, 23, 0.78),
        0 0 18px rgba(34, 211, 238, 0.24);
    `;
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
      },
      { passive: false },
    );

    const moduleList = this.createSelectList(
      this.options.getModuleIds(),
      (id) => `Spawn module: ${id}`,
      this.options.onRunModule,
    );
    const waveControl = this.createLevelWaveControl();
    const bossLevelControl = this.createBossLevelControl();

    const hitboxEnabled =
      localStorage.getItem(SHOW_HITBOXES_STORAGE_KEY) === "true";
    const hitboxBtn = this.createToggleButton(
      "HITBOX",
      hitboxEnabled,
      (enabled) => {
        localStorage.setItem(SHOW_HITBOXES_STORAGE_KEY, String(enabled));
        this.options.onHitboxToggle(enabled);
      },
    );

    const clearBtn = this.createButton("CLEAR", this.options.onClear);

    panel.append(
      this.createAccordion("MODULE", moduleList),
      this.createAccordion("WAVE", waveControl),
      this.createAccordion("BOSS", bossLevelControl),
      this.createAccordion("VIEW", hitboxBtn),
      clearBtn,
    );

    document.body.appendChild(panel);
    this.panel = panel;
    this.options.onOpenChange(true);
  };

  /** 単一選択リスト: クリックで即時実行し、選択中をハイライトする */
  private createSelectList = <T extends string | { label: string }>(
    ids: T[],
    title: (id: T) => string,
    onSelect: (id: T) => void,
    wrap = false,
  ) => {
    const container = document.createElement("div");
    container.style.cssText = `display: flex; flex-direction: column; gap: 3px;`;
    for (const id of ids) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = typeof id === "string" ? id : id.label;
      btn.title = title(id);
      btn.style.cssText = `
        width: 100%;
        min-height: 22px;
        border: 1px solid rgba(103, 232, 249, 0.45);
        border-radius: 3px;
        background: rgba(8, 47, 73, 0.7);
        color: rgba(224, 250, 255, 0.85);
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.5px;
        cursor: pointer;
        text-align: left;
        padding: 3px 5px;
        overflow: hidden;
        word-break: break-all;
        white-space: ${wrap ? "normal" : "nowrap"};
        ${wrap ? "" : "text-overflow: ellipsis;"}
      `;
      btn.addEventListener("click", () => {
        onSelect(id);
        for (const b of container.querySelectorAll("button"))
          (b as HTMLButtonElement).style.background = "rgba(8, 47, 73, 0.7)";
        btn.style.background = "rgba(34, 211, 238, 0.22)";
      });
      container.appendChild(btn);
    }
    return container;
  };

  private createLevelWaveControl = () => {
    const container = document.createElement("div");
    container.style.cssText = `display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px;`;

    const input = this.createSmallNumberInput("1", "1", "Wave level");
    input.min = "1";
    input.max = "20";
    input.value = "1";

    const list = document.createElement("div");
    list.style.cssText = `
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 3px;
    `;

    const readLevel = () => Math.max(1, Math.floor(Number(input.value) || 1));
    const render = () => {
      const level = readLevel();
      input.value = String(level);
      list.replaceChildren(
        this.createSelectList(
          this.options.getLevelWaveOptions(level),
          (wave) => `Spawn real lv${level} wave: ${wave.label}`,
          (wave) => this.options.onRunLevelWave(level, wave.index),
          true,
        ),
      );
    };

    input.addEventListener("input", render);
    render();
    container.append(this.createMiniLabel("lv"), input, list);
    return container;
  };

  private createBossLevelControl = () => {
    const container = document.createElement("div");
    container.style.cssText = `display: grid; grid-template-columns: 1fr 66px; gap: 4px;`;
    const selectedPatterns = new Set<ArtCruiseEnemyBulletPatternId>();
    const patternTunings = new Map<
      ArtCruiseEnemyBulletPatternId,
      ArtCruiseBulletPatternTuning
    >();

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "20";
    input.step = "1";
    input.value = "1";
    input.title = "Boss level for pattern tuning";
    input.style.cssText = `
      width: 100%;
      min-width: 0;
      height: 24px;
      border: 1px solid rgba(103, 232, 249, 0.45);
      border-radius: 3px;
      background: rgba(2, 6, 23, 0.86);
      color: rgba(224, 250, 255, 0.9);
      font-size: 10px;
      font-weight: 900;
      padding: 0 5px;
    `;

    const speedInput = this.createSmallNumberInput(
      "real",
      "0.05",
      "Bullet speed scale",
    );
    const intervalInput = this.createSmallNumberInput(
      "real",
      "0.05",
      "Fire interval scale",
    );
    const patternList = this.createMultiPatternList(
      this.options.getBossBulletPatternIds(),
      selectedPatterns,
      patternTunings,
    );

    const btn = this.createButton("SPAWN", () => {
      const speedScale = this.parseOptionalNumber(speedInput.value);
      const intervalScale = this.parseOptionalNumber(intervalInput.value);
      const tuning = {
        ...(speedScale === undefined ? {} : { speedScale }),
        ...(intervalScale === undefined ? {} : { intervalScale }),
      };
      const localTunings = Object.fromEntries(patternTunings);
      const options: ArtCruiseDebugBossOptions = {
        patterns: selectedPatterns.size
          ? Array.from(selectedPatterns)
          : undefined,
        tuning: Object.keys(tuning).length ? tuning : undefined,
        patternTunings: Object.keys(localTunings).length
          ? localTunings
          : undefined,
      };
      const level = Math.max(1, Math.floor(Number(input.value) || 1));
      input.value = String(level);
      this.options.onSpawnBossLevel(level, options);
    });
    btn.style.height = "24px";
    btn.style.marginTop = "0";
    const nextPhaseBtn = this.createButton(
      "NEXT PHASE",
      this.options.onAdvanceBossPhase,
    );
    nextPhaseBtn.title = "Clear current boss phase";
    nextPhaseBtn.style.gridColumn = "1 / -1";
    nextPhaseBtn.style.height = "24px";
    nextPhaseBtn.style.marginTop = "0";

    container.append(
      input,
      btn,
      this.createMiniLabel("speed"),
      speedInput,
      this.createMiniLabel("interval"),
      intervalInput,
      this.createMiniLabel("patterns"),
      patternList,
      nextPhaseBtn,
    );
    return container;
  };

  private createSmallNumberInput = (
    placeholder: string,
    step: string,
    title: string,
  ) => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = step;
    input.placeholder = placeholder;
    input.title = title;
    input.style.cssText = this.getCompactInputStyle();
    return input;
  };

  private getCompactInputStyle = () => `
      width: 100%;
      min-width: 0;
      height: 22px;
      border: 1px solid rgba(103, 232, 249, 0.45);
      border-radius: 3px;
      background: rgba(2, 6, 23, 0.86);
      color: rgba(224, 250, 255, 0.9);
      font-size: 9px;
      font-weight: 900;
      padding: 0 5px;
    `;

  private parseOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  private createMultiPatternList = (
    ids: ArtCruiseEnemyBulletPatternId[],
    selected: Set<ArtCruiseEnemyBulletPatternId>,
    tunings: Map<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>,
  ) => {
    const container = document.createElement("div");
    container.style.cssText = `
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 3px;
    `;

    for (const id of ids) {
      const row = document.createElement("div");
      row.style.cssText = `display: grid; grid-template-columns: minmax(0, 1fr) 40px; gap: 3px;`;
      const btn = this.createToggleButton(id, false, (enabled) => {
        if (enabled) selected.add(id);
        else selected.delete(id);
      });
      btn.title = `Toggle boss pattern: ${id}`;
      const tuningPanel = this.createPatternTuningMenu(id, tunings);
      const menuBtn = this.createButton("SET", () => {
        tuningPanel.style.display =
          tuningPanel.style.display === "none" ? "grid" : "none";
      });
      menuBtn.title = `Tune boss pattern: ${id}`;
      menuBtn.style.height = "22px";
      menuBtn.style.marginTop = "0";
      menuBtn.style.fontSize = "8px";
      row.append(btn, menuBtn, tuningPanel);
      container.appendChild(row);
    }
    return container;
  };

  private createPatternTuningMenu = (
    id: ArtCruiseEnemyBulletPatternId,
    tunings: Map<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>,
  ) => {
    const panel = document.createElement("div");
    panel.style.cssText = `
      grid-column: 1 / -1;
      display: none;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 3px;
      padding: 4px;
      border: 1px solid rgba(103, 232, 249, 0.25);
      border-radius: 3px;
      background: rgba(2, 6, 23, 0.62);
    `;
    const fields = [
      ["speed", "speedScale"],
      ["accel", "accel"],
      ["min", "minSpeed"],
      ["size", "sizeScale"],
      ["delay", "delayScale"],
      ["int", "intervalScale"],
    ] as const;
    const inputs = fields.map(([label, key]) => {
      const wrapper = this.createTuningFieldWrapper(label);
      const input = this.createSmallNumberInput("real", "0.05", key);
      wrapper.append(label, input);
      return [key, input, wrapper] as const;
    });
    const specificInputs = this.createPatternSpecificTuningInputs(id);
    const sync = () => {
      const tuning = Object.fromEntries(
        inputs.flatMap(([key, input]) => {
          const value = this.parseOptionalNumber(input.value);
          return value === undefined ? [] : [[key, value] as const];
        }),
      ) as ArtCruiseBulletPatternTuning;
      for (const input of specificInputs) input.read(tuning);
      if (Object.keys(tuning).length) tunings.set(id, tuning);
      else tunings.delete(id);
    };
    for (const [, input, wrapper] of inputs) {
      input.addEventListener("input", sync);
      panel.appendChild(wrapper);
    }
    for (const input of specificInputs) {
      input.wrapper.addEventListener("input", sync);
      input.wrapper.addEventListener("click", sync);
      input.wrapper.addEventListener("change", sync);
      panel.appendChild(input.wrapper);
    }
    return panel;
  };

  private createPatternSpecificTuningInputs = (
    id: ArtCruiseEnemyBulletPatternId,
  ): PatternTuningInput[] => {
    if (id === "burst") return this.createBurstTuningInputs();
    if (id === "bossDenseRing") return this.createDenseRingTuningInputs();
    if (id === "bossEdgeBeam") return this.createEdgeBeamTuningInputs();
    if (id === "bossFlappyGate") return this.createFlappyGateTuningInputs();
    if (id === "bossReflectLaser") return this.createReflectLaserTuningInputs();
    if (id === "bossAbyssalUpdraft")
      return this.createAbyssalUpdraftTuningInputs();

    const tuningKey = this.getEdgeBarrageTuningKey(id);
    if (!tuningKey) return [];

    const inputs: PatternTuningInput[] = [
      this.createEdgeBarrageAimInput(tuningKey),
      this.createEdgeBarrageFireModeInput(tuningKey),
    ];
    for (const field of EDGE_BARRAGE_NUMBER_FIELDS)
      inputs.push(this.createEdgeBarrageNumberInput(tuningKey, field));
    return inputs;
  };

  private createEdgeBeamTuningInputs = (): PatternTuningInput[] => [
    this.createEdgeBeamSelectInput("layout", "turretLayout", [
      "top",
      "perimeter",
      "corners",
    ]),
    this.createEdgeBeamSelectInput("mode", "fireMode", [
      "sequence",
      "random",
      "all",
    ]),
    this.createEdgeBeamSelectInput("angle", "angleMode", [
      "straight",
      "center",
      "random",
      "fixed",
    ]),
    ...EDGE_BEAM_NUMBER_FIELDS.map((field) =>
      this.createEdgeBeamNumberInput(field),
    ),
  ];

  private createBurstTuningInputs = (): PatternTuningInput[] => [
    this.createBurstAimInput(),
    this.createBurstBulletArtInput(),
    ...BURST_NUMBER_FIELDS.map((field) =>
      this.createBurstNumberInput(field),
    ),
  ];

  private createDenseRingTuningInputs = (): PatternTuningInput[] => [
    this.createDenseRingBulletArtInput(),
    ...DENSE_RING_NUMBER_FIELDS.map((field) =>
      this.createDenseRingNumberInput(field),
    ),
  ];

  private createAbyssalUpdraftTuningInputs = (): PatternTuningInput[] =>
    ABYSSAL_UPDRAFT_NUMBER_FIELDS.map((field) =>
      this.createAbyssalUpdraftNumberInput(field),
    );

  private createFlappyGateTuningInputs = (): PatternTuningInput[] => [
    this.createFlappyGateSideInput(),
    ...FLAPPY_GATE_NUMBER_FIELDS.map((field) =>
      this.createFlappyGateNumberInput(field),
    ),
  ];

  private createReflectLaserTuningInputs = (): PatternTuningInput[] => [
    this.createReflectLaserOffsetsInput(),
    this.createReflectLaserSplitInput(),
    ...REFLECT_LASER_NUMBER_FIELDS.map((field) =>
      this.createReflectLaserNumberInput(field),
    ),
  ];

  private createBurstAimInput = (): PatternTuningInput => {
    const states = ["-", "ON", "OFF"] as const;
    let stateIndex = 0;
    const wrapper = this.createTuningFieldWrapper("aim");
    const btn = this.createTinyToggleButton(states[stateIndex], () => {
      stateIndex = (stateIndex + 1) % states.length;
      btn.textContent = states[stateIndex];
    });
    wrapper.append("aim", btn);
    return {
      wrapper,
      read: (tuning) => {
        if (states[stateIndex] === "-") return;
        tuning.burst ??= {};
        tuning.burst.aimAtPlayer = states[stateIndex] === "ON";
      },
    };
  };

  private createBurstBulletArtInput = (): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper("art");
    const select = document.createElement("select");
    select.title = "Burst bullet art";
    select.style.cssText = this.getCompactInputStyle();
    for (const [value, label] of [
      ["", "-"],
      ["bullet-yellow-circle", "yellow"],
      ["blue", "blue"],
      ["red", "red"],
      ["green", "green"],
      ["purple", "purple"],
      ["greenCapsule", "green cap"],
      ["iceCapsule", "ice cap"],
      ["kunaiCapsule", "kunai cap"],
      ["smallSilver", "silver"],
      ["silverCapsule", "silver cap"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    wrapper.append("art", select);
    return {
      wrapper,
      read: (tuning) => {
        if (!select.value) return;
        tuning.burst ??= {};
        tuning.burst.bulletArt = select.value as ArtCruiseBurstBulletArt;
      },
    };
  };

  private createBurstNumberInput = (
    field: PatternNumberField<BurstNumberKey>,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        tuning.burst ??= {};
        tuning.burst[field.key] = value;
      },
    };
  };

  private getDenseRingTuning = (tuning: ArtCruiseBulletPatternTuning) => {
    tuning.denseRing ??= {};
    return tuning.denseRing;
  };

  private createDenseRingBulletArtInput = (): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper("art");
    const select = document.createElement("select");
    select.title = "Dense ring bullet art";
    select.style.cssText = this.getCompactInputStyle();
    for (const [value, label] of [
      ["", "-"],
      ["bullet-yellow-circle", "yellow"],
      ["blue", "blue"],
      ["red", "red"],
      ["green", "green"],
      ["purple", "purple"],
      ["greenCapsule", "green cap"],
      ["iceCapsule", "ice cap"],
      ["kunaiCapsule", "kunai cap"],
      ["smallSilver", "silver"],
      ["silverCapsule", "silver cap"],
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    wrapper.append("art", select);
    return {
      wrapper,
      read: (tuning) => {
        if (!select.value) return;
        this.getDenseRingTuning(tuning).bulletArt =
          select.value as ArtCruiseBurstBulletArt;
      },
    };
  };

  private createDenseRingNumberInput = (
    field: PatternNumberField<DenseRingNumberKey>,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        this.getDenseRingTuning(tuning)[field.key] = value;
      },
    };
  };

  private createAbyssalUpdraftNumberInput = (
    field: PatternNumberField<AbyssalUpdraftNumberKey>,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        tuning.abyssalUpdraft ??= {};
        tuning.abyssalUpdraft[field.key] = value;
      },
    };
  };

  private getFlappyGateTuning = (tuning: ArtCruiseBulletPatternTuning) => {
    tuning.flappyGate ??= {};
    return tuning.flappyGate;
  };

  private createFlappyGateSideInput = (): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper("side");
    const select = document.createElement("select");
    select.title = "Flappy gate side";
    select.style.cssText = this.getCompactInputStyle();
    for (const value of [
      "",
      "right",
      "left",
      "top",
      "bottom",
      "random",
      "cycle",
    ] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value || "-";
      select.appendChild(option);
    }
    wrapper.append("side", select);
    return {
      wrapper,
      read: (tuning) => {
        if (!select.value) return;
        this.getFlappyGateTuning(tuning).side =
          select.value as ArtCruiseFlappyGateConfig["side"];
      },
    };
  };

  private createFlappyGateNumberInput = (
    field: PatternNumberField<FlappyGateNumberKey>,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        this.getFlappyGateTuning(tuning)[field.key] = value;
      },
    };
  };

  private getReflectLaserTuning = (tuning: ArtCruiseBulletPatternTuning) => {
    tuning.reflectLaser ??= {};
    return tuning.reflectLaser;
  };

  private createReflectLaserOffsetsInput = (): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper("offsets");
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "-0.46,-0.28,0.28";
    input.title = "Reflect laser offsets, comma separated radians";
    input.style.cssText = this.getCompactInputStyle();
    wrapper.append("offsets", input);
    return {
      wrapper,
      read: (tuning) => {
        const offsets = input.value
          .split(",")
          .map((value) => this.parseOptionalNumber(value))
          .filter((value): value is number => value !== undefined);
        if (!offsets.length) return;
        this.getReflectLaserTuning(tuning).offsets = offsets;
      },
    };
  };

  private createReflectLaserSplitInput = (): PatternTuningInput => {
    const states = ["-", "ON", "OFF"] as const;
    let stateIndex = 0;
    const wrapper = this.createTuningFieldWrapper("split");
    const btn = this.createTinyToggleButton(states[stateIndex], () => {
      stateIndex = (stateIndex + 1) % states.length;
      btn.textContent = states[stateIndex];
    });
    wrapper.append("split", btn);
    return {
      wrapper,
      read: (tuning) => {
        if (states[stateIndex] === "-") return;
        this.getReflectLaserTuning(tuning).splitOnBoundary =
          states[stateIndex] === "ON";
      },
    };
  };

  private createReflectLaserNumberInput = (
    field: PatternNumberField<ReflectLaserNumberKey>,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        this.getReflectLaserTuning(tuning)[field.key] = value;
      },
    };
  };

  private getEdgeBeamTuning = (tuning: ArtCruiseBulletPatternTuning) => {
    tuning.edgeBeam ??= {};
    return tuning.edgeBeam;
  };

  private createEdgeBeamSelectInput = <K extends keyof ArtCruiseEdgeBeamConfig>(
    label: string,
    key: K,
    values: NonNullable<ArtCruiseEdgeBeamConfig[K]>[],
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(label);
    const select = document.createElement("select");
    select.title = `Edge beam ${String(key)}`;
    select.style.cssText = this.getCompactInputStyle();
    for (const value of ["", ...values]) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = value ? String(value) : "-";
      select.appendChild(option);
    }
    wrapper.append(label, select);
    return {
      wrapper,
      read: (tuning) => {
        if (!select.value) return;
        this.getEdgeBeamTuning(tuning)[key] = select.value as
          ArtCruiseEdgeBeamConfig[K] & string;
      },
    };
  };

  private createEdgeBeamNumberInput = (
    field: PatternNumberField<EdgeBeamNumberKey>,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        this.getEdgeBeamTuning(tuning)[field.key] = value;
      },
    };
  };

  private getEdgeBarrageTuningKey = (
    id: ArtCruiseEnemyBulletPatternId,
  ): EdgeBarrageTuningKey | null => {
    if (id === "bossSideKunaiBarrage") return "sideKunai";
    if (id === "bossTopIceRain") return "topIce";
    return null;
  };

  private getEdgeBarrageTuning = (
    tuning: ArtCruiseBulletPatternTuning,
    key: EdgeBarrageTuningKey,
  ) => {
    tuning[key] ??= {};
    return tuning[key];
  };

  private createEdgeBarrageAimInput = (
    tuningKey: EdgeBarrageTuningKey,
  ): PatternTuningInput => {
    const states = ["-", "ON", "OFF"] as const;
    let stateIndex = 0;
    const wrapper = this.createTuningFieldWrapper("aim");
    const btn = this.createTinyToggleButton(states[stateIndex], () => {
      stateIndex = (stateIndex + 1) % states.length;
      btn.textContent = states[stateIndex];
    });
    wrapper.append("aim", btn);
    return {
      wrapper,
      read: (tuning) => {
        if (states[stateIndex] === "-") return;
        this.getEdgeBarrageTuning(tuning, tuningKey).aimAtPlayer =
          states[stateIndex] === "ON";
      },
    };
  };

  private createEdgeBarrageFireModeInput = (
    tuningKey: EdgeBarrageTuningKey,
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper("mode");
    const select = document.createElement("select");
    select.title = "Kunai fire mode";
    select.style.cssText = this.getCompactInputStyle();
    for (const value of ["", "sequence", "random", "all"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value || "-";
      select.appendChild(option);
    }
    wrapper.append("mode", select);
    return {
      wrapper,
      read: (tuning) => {
        if (!select.value) return;
        this.getEdgeBarrageTuning(tuning, tuningKey).fireMode = select.value as
          | "all"
          | "random"
          | "sequence";
      },
    };
  };

  private createEdgeBarrageNumberInput = (
    tuningKey: EdgeBarrageTuningKey,
    field: {
      label: string;
      key: EdgeBarrageNumberKey;
      step: string;
      title: string;
    },
  ): PatternTuningInput => {
    const wrapper = this.createTuningFieldWrapper(field.label);
    const input = this.createSmallNumberInput("real", field.step, field.title);
    wrapper.append(field.label, input);
    return {
      wrapper,
      read: (tuning) => {
        const value = this.parseOptionalNumber(input.value);
        if (value === undefined) return;
        this.getEdgeBarrageTuning(tuning, tuningKey)[field.key] = value;
      },
    };
  };

  private createTuningFieldWrapper = (label: string) => {
    const wrapper = document.createElement("label");
    wrapper.title = label;
    wrapper.style.cssText = `
      display: grid;
      grid-template-columns: 42px minmax(0, 1fr);
      align-items: center;
      gap: 3px;
      color: rgba(224, 250, 255, 0.58);
      font-size: 8px;
      font-weight: 900;
      min-width: 0;
    `;
    return wrapper;
  };

  private createAccordion = (
    title: string,
    content: HTMLElement,
    open = true,
  ) => {
    const details = document.createElement("details");
    details.open = open;
    details.style.cssText = `
      margin-bottom: 4px;
      border: 1px solid rgba(103, 232, 249, 0.24);
      border-radius: 3px;
      background: rgba(8, 47, 73, 0.26);
    `;
    const summary = document.createElement("summary");
    summary.textContent = title;
    summary.style.cssText = `
      padding: 5px 6px;
      color: rgba(224, 250, 255, 0.72);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.9px;
      cursor: pointer;
      user-select: none;
    `;
    const body = document.createElement("div");
    body.style.cssText = `padding: 0 5px 5px;`;
    body.appendChild(content);
    details.append(summary, body);
    return details;
  };

  private createMiniLabel = (text: string) => {
    const label = document.createElement("div");
    label.textContent = text;
    label.style.cssText = `
      align-self: center;
      color: rgba(224, 250, 255, 0.58);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.6px;
    `;
    return label;
  };

  private createToggleButton = (
    label: string,
    initial: boolean,
    onChange: (v: boolean) => void,
  ) => {
    const btn = document.createElement("button");
    btn.type = "button";
    let active = initial;
    const update = () => {
      btn.textContent = `${label}: ${active ? "ON" : "OFF"}`;
      btn.style.borderColor = active
        ? "rgba(103, 232, 249, 0.9)"
        : "rgba(103, 232, 249, 0.45)";
      btn.style.background = active
        ? "rgba(34, 211, 238, 0.22)"
        : "rgba(8, 47, 73, 0.7)";
    };
    btn.style.cssText = `
      width: 100%;
      height: 22px;
      border: 1px solid rgba(103, 232, 249, 0.45);
      border-radius: 3px;
      background: rgba(8, 47, 73, 0.7);
      color: rgba(224, 250, 255, 0.85);
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.5px;
      cursor: pointer;
      text-align: left;
      padding: 0 5px;
    `;
    update();
    btn.addEventListener("click", () => {
      active = !active;
      update();
      onChange(active);
    });
    return btn;
  };

  private createTinyToggleButton = (label: string, onClick: () => void) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%;
      min-width: 0;
      height: 22px;
      border: 1px solid rgba(103, 232, 249, 0.45);
      border-radius: 3px;
      background: rgba(8, 47, 73, 0.7);
      color: rgba(224, 250, 255, 0.85);
      font-size: 9px;
      font-weight: 900;
      cursor: pointer;
      padding: 0 5px;
    `;
    btn.addEventListener("click", onClick);
    return btn;
  };

  private createButton = (label: string, onClick: () => void) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%;
      height: 27px;
      margin-top: 6px;
      border: 1px solid rgba(103, 232, 249, 0.78);
      border-radius: 4px;
      background: linear-gradient(180deg, rgba(8, 47, 73, 0.92), rgba(12, 74, 110, 0.86));
      color: #f0f9ff;
      box-shadow: inset 0 0 12px rgba(34, 211, 238, 0.2);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.9px;
      text-shadow: 0 0 8px rgba(224, 250, 255, 0.45);
      cursor: pointer;
    `;
    btn.addEventListener("click", onClick);
    return btn;
  };
}
