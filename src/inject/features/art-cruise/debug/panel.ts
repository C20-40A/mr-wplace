import { SHOW_HITBOXES_STORAGE_KEY } from "../constants";
import type { ArtCruiseEnemyBulletPatternId } from "../enemy/enemy-rules/types";
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
  getBulletPatternIds: () => ArtCruiseEnemyBulletPatternId[];
  onRunBulletPattern: (patternId: ArtCruiseEnemyBulletPatternId, level: number) => void;
  getBossBulletPatternIds: () => ArtCruiseEnemyBulletPatternId[];
  onSpawnBossLevel: (
    level: number,
    options?: ArtCruiseDebugBossOptions,
  ) => void;
  onAdvanceBossPhase: () => void;
  onHitboxToggle: (enabled: boolean) => void;
};

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
      width: 220px;
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
    panel.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });

    const moduleList = this.createSelectList(
      this.options.getModuleIds(),
      (id) => `Spawn module: ${id}`,
      this.options.onRunModule,
    );
    const bulletLevelInput = this.createSmallNumberInput("1", "1", "Level for bullet pattern tuning");
    bulletLevelInput.min = "1";
    bulletLevelInput.max = "20";
    bulletLevelInput.value = "1";
    bulletLevelInput.style.gridColumn = "1 / -1";
    const getBulletLevel = () => Math.max(1, Math.floor(Number(bulletLevelInput.value) || 1));
    const bulletLevelWrapper = document.createElement("div");
    bulletLevelWrapper.style.cssText = `display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px; margin-bottom: 3px;`;
    const bulletLevelLabel = this.createMiniLabel("lv");
    bulletLevelWrapper.append(bulletLevelLabel, bulletLevelInput);
    const bulletList = this.createSelectList(
      this.options.getBulletPatternIds(),
      (id) => `Test bullet pattern: ${id}`,
      (id) => this.options.onRunBulletPattern(id, getBulletLevel()),
      true,
    );
    const bossLevelControl = this.createBossLevelControl();

    const hitboxEnabled = localStorage.getItem(SHOW_HITBOXES_STORAGE_KEY) === "true";
    const hitboxBtn = this.createToggleButton("HITBOX", hitboxEnabled, (enabled) => {
      localStorage.setItem(SHOW_HITBOXES_STORAGE_KEY, String(enabled));
      this.options.onHitboxToggle(enabled);
    });

    const clearBtn = this.createButton("CLEAR", this.options.onClear);

    panel.append(
      this.createLabel("MODULE"),
      moduleList,
      this.createLabel("BULLET"),
      bulletLevelWrapper,
      bulletList,
      this.createLabel("BOSS"),
      bossLevelControl,
      this.createLabel("VIEW"),
      hitboxBtn,
      clearBtn,
    );

    document.body.appendChild(panel);
    this.panel = panel;
    this.options.onOpenChange(true);
  };

  /** 単一選択リスト: クリックで即時実行し、選択中をハイライトする */
  private createSelectList = <T extends string>(
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
      btn.textContent = id;
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

  private createBossLevelControl = () => {
    const container = document.createElement("div");
    container.style.cssText = `display: grid; grid-template-columns: 1fr 66px; gap: 4px;`;
    const selectedPatterns = new Set<ArtCruiseEnemyBulletPatternId>();

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
    );

    const btn = this.createButton("SPAWN", () => {
      const speedScale = this.parseOptionalNumber(speedInput.value);
      const intervalScale = this.parseOptionalNumber(intervalInput.value);
      const tuning = {
        ...(speedScale === undefined ? {} : { speedScale }),
        ...(intervalScale === undefined ? {} : { intervalScale }),
      };
      const options: ArtCruiseDebugBossOptions = {
        patterns: selectedPatterns.size
          ? Array.from(selectedPatterns)
          : undefined,
        tuning: Object.keys(tuning).length ? tuning : undefined,
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
    input.style.cssText = `
      width: 100%;
      min-width: 0;
      height: 22px;
      border: 1px solid rgba(103, 232, 249, 0.45);
      border-radius: 3px;
      background: rgba(2, 6, 23, 0.86);
      color: rgba(224, 250, 255, 0.9);
      font-size: 10px;
      font-weight: 900;
      padding: 0 5px;
    `;
    return input;
  };

  private parseOptionalNumber = (value: string) => {
    if (!value.trim()) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };

  private createMultiPatternList = (
    ids: ArtCruiseEnemyBulletPatternId[],
    selected: Set<ArtCruiseEnemyBulletPatternId>,
  ) => {
    const container = document.createElement("div");
    container.style.cssText = `
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 3px;
      max-height: 118px;
      overflow: auto;
    `;

    for (const id of ids) {
      const btn = this.createToggleButton(id, false, (enabled) => {
        if (enabled) selected.add(id);
        else selected.delete(id);
      });
      btn.title = `Toggle boss pattern: ${id}`;
      container.appendChild(btn);
    }
    return container;
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

  private createLabel = (text: string) => {
    const label = document.createElement("div");
    label.textContent = text;
    label.style.cssText = `
      margin: 7px 0 4px;
      color: rgba(224, 250, 255, 0.68);
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.9px;
    `;
    return label;
  };

  private createToggleButton = (label: string, initial: boolean, onChange: (v: boolean) => void) => {
    const btn = document.createElement("button");
    btn.type = "button";
    let active = initial;
    const update = () => {
      btn.textContent = `${label}: ${active ? "ON" : "OFF"}`;
      btn.style.borderColor = active ? "rgba(103, 232, 249, 0.9)" : "rgba(103, 232, 249, 0.45)";
      btn.style.background = active ? "rgba(34, 211, 238, 0.22)" : "rgba(8, 47, 73, 0.7)";
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
