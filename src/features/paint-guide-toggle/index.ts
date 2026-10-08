import {
  getPaintToolbarContainer,
  registerPaintToolbarButton,
  setPaintToolbarButtonActive,
} from "@/features/paint-toolbar";
import {
  loadPaintGuideFromStorage,
  getPaintGuide,
  getPaintGuideKinds,
  setPaintGuideKind,
  PAINT_GUIDE_KINDS,
  type PaintGuideKind,
} from "@/states/paint-guide";
import {
  loadPaintBeaconFromStorage,
  getPaintBeacon,
  getPaintBeaconThreshold,
  setPaintBeacon,
  setPaintBeaconThreshold,
  BEACON_THRESHOLD_MIN,
  BEACON_THRESHOLD_MAX,
  BEACON_THRESHOLD_STEP,
} from "@/states/paint-beacon";
import {
  loadFrontTileLayerFromStorage,
  getFrontTileLayer,
  setFrontTileLayer,
} from "@/states/front-tile-layer";
import {
  getOverlayLightweightMode,
  setOverlayLightweightMode,
} from "@/states/overlay-lightweight-mode";
import { t } from "@/i18n";
import { subscribePaintMode } from "@/utils/paint-mode";
import { showPaintNotice } from "@/components/paint-notice";
import { ensureStyle } from "@/utils/style";

const BUTTON_ID = "paint-guide-toggle-btn";
const PANEL_ID = "paint-guide-panel";
const STYLE_ID = "paint-guide-panel-style";

const ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M8 12.5l2.5 2.5L16 9.5"/>
  </svg>
`;

/** paint-guide-canvas のドット色と揃える */
const BEACON_COLOR = "#ff0000";

const KIND_COLOR: Record<PaintGuideKind, string> = {
  mismatch: "#ffbf00",
  overflow: "#a855f7",
  already: "#00d4ff",
};

const KIND_LABEL_KEY: Record<PaintGuideKind, string> = {
  mismatch: "paint_guide_kind_mismatch",
  overflow: "paint_guide_kind_overflow",
  already: "paint_guide_kind_already",
};

/** トグル操作時に出す説明 hint (on/off) */
const KIND_NOTICE_KEY: Record<PaintGuideKind, [string, string]> = {
  mismatch: [
    "notice_paint_guide_mismatch_on",
    "notice_paint_guide_mismatch_off",
  ],
  overflow: [
    "notice_paint_guide_overflow_on",
    "notice_paint_guide_overflow_off",
  ],
  already: ["notice_paint_guide_already_on", "notice_paint_guide_already_off"],
};

const ensureStyles = (): void => {
  ensureStyle(STYLE_ID, `
    #${PANEL_ID}{position:fixed;z-index:60;display:flex;flex-direction:column;gap:3px;padding:6px;background:var(--color-base-100,#fff);color:var(--color-base-content,#222);border:1px solid var(--color-base-300,rgba(0,0,0,0.12));border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,0.18);}
    #${PANEL_ID} .pg-item{display:flex;align-items:center;gap:6px;min-width:150px;padding:4px 7px;border-radius:7px;border:1px solid var(--color-base-300,rgba(0,0,0,0.12));background:transparent;color:inherit;cursor:pointer;font-size:11px;text-align:left;}
    #${PANEL_ID} .pg-item:hover{background:var(--color-base-200,rgba(0,0,0,0.06));}
    #${PANEL_ID} .pg-dot{width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,0.45);flex:none;}
    #${PANEL_ID} .pg-label{flex:1;}
    #${PANEL_ID} .pg-state{font-size:9px;font-weight:700;letter-spacing:.04em;opacity:.55;}
    #${PANEL_ID} .pg-item.on{border-color:var(--color-primary,#0f766e);}
    #${PANEL_ID} .pg-item.on .pg-state{opacity:1;color:var(--color-primary,#0f766e);}
    #${PANEL_ID} .pg-item.off .pg-dot{opacity:.25;}
    #${PANEL_ID} .pg-sep{height:1px;margin:2px 0;background:var(--color-base-300,rgba(0,0,0,0.12));}
    #${PANEL_ID} .pg-slider{display:flex;flex-direction:column;gap:3px;padding:2px 7px 4px;}
    #${PANEL_ID} .pg-slider[hidden]{display:none;}
    #${PANEL_ID} .pg-slider input{width:100%;accent-color:var(--color-primary,#0f766e);}
    #${PANEL_ID} .pg-slider-desc{font-size:9px;line-height:12px;opacity:.65;}
    #${PANEL_ID} .pg-warn{display:flex;flex-direction:column;gap:5px;max-width:190px;margin-top:2px;padding:6px 7px;border-radius:8px;border:1px solid var(--color-warning,#f59e0b);background:color-mix(in srgb, var(--color-warning,#f59e0b) 14%, transparent);font-size:10px;line-height:14px;}
    #${PANEL_ID} .pg-warn-btn{align-self:stretch;padding:4px 6px;border-radius:6px;border:0;background:var(--color-warning,#f59e0b);color:var(--color-warning-content,#1f1300);font-size:10px;font-weight:700;cursor:pointer;}
    #${PANEL_ID} .pg-warn-btn:hover{filter:brightness(1.05);}
  `);
};

/** paint toolbar から テンプレ一致インジケーター(paint guide) を種別ごとに ON/OFF する */
export class PaintGuideToggle {
  private button: HTMLButtonElement | null = null;
  private panel: HTMLDivElement | null = null;
  private outsideHandler: ((e: PointerEvent) => void) | null = null;

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    ensureStyles();
    await Promise.all([
      loadPaintGuideFromStorage(),
      loadPaintBeaconFromStorage(),
      loadFrontTileLayerFromStorage(),
    ]);
    this.sendBeaconToInject();
    registerPaintToolbarButton({
      id: BUTTON_ID,
      tip: t("popup_paint_guide"),
      label: "Guide",
      icon: ICON,
      isActive: getPaintGuide,
      onClick: () => this.togglePanel(),
      onCreate: (button) => {
        this.button = button;
        console.log("🧑‍🎨 : Paint guide toggle button added");
      },
    });

    subscribePaintMode((active) => {
      if (!active) this.closePanel();
    });
  }

  private togglePanel(): void {
    if (this.panel) {
      this.closePanel();
      return;
    }
    this.openPanel();
  }

  private openPanel(): void {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    this.panel = panel;

    for (const kind of PAINT_GUIDE_KINDS) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "pg-item";
      item.innerHTML = `<span class="pg-dot" style="background:${KIND_COLOR[kind]}"></span><span class="pg-label">${t(KIND_LABEL_KEY[kind])}</span><span class="pg-state"></span>`;
      item.addEventListener("click", () => {
        void this.toggleKind(kind, item);
      });
      this.applyItemState(item, getPaintGuideKinds()[kind]);
      panel.appendChild(item);
    }

    const separator = document.createElement("div");
    separator.className = "pg-sep";
    panel.appendChild(separator);
    panel.appendChild(this.buildBeaconRows());

    // overlay が「独立」でないとガイド/ビーコンが機能しないため、切替導線を出す
    if (!getFrontTileLayer()) panel.appendChild(this.buildLayerModeWarning());

    document.body.appendChild(panel);
    this.positionPanel(panel);
    if (this.button) setPaintToolbarButtonActive(this.button, true);

    this.outsideHandler = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.contains(target) || this.button?.contains(target)) return;
      this.closePanel();
    };
    document.addEventListener("pointerdown", this.outsideHandler, {
      capture: true,
    });
  }

  /** 塗り残しビーコン: トグル + (ON のときだけ) 閾値スライダー */
  private buildBeaconRows(): DocumentFragment {
    const fragment = document.createDocumentFragment();

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "pg-item";
    toggle.innerHTML = `<span class="pg-dot" style="background:${BEACON_COLOR}"></span><span class="pg-label">${t("paint_beacon_label")}</span><span class="pg-state"></span>`;
    this.applyItemState(toggle, getPaintBeacon());
    fragment.appendChild(toggle);

    const sliderRow = document.createElement("div");
    sliderRow.className = "pg-slider";
    const desc = document.createElement("div");
    desc.className = "pg-slider-desc";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(BEACON_THRESHOLD_MIN);
    slider.max = String(BEACON_THRESHOLD_MAX);
    slider.step = String(BEACON_THRESHOLD_STEP);
    slider.value = String(getPaintBeaconThreshold());
    sliderRow.append(slider, desc);
    fragment.appendChild(sliderRow);

    const renderDesc = (value: number): void => {
      desc.textContent = t("paint_beacon_desc").replace("{n}", String(value));
    };
    const syncSliderVisibility = (): void => {
      sliderRow.hidden = !getPaintBeacon();
    };
    renderDesc(getPaintBeaconThreshold());
    syncSliderVisibility();

    toggle.addEventListener("click", () => {
      void (async () => {
        const enabled = !getPaintBeacon();
        await setPaintBeacon(enabled);
        this.applyItemState(toggle, enabled);
        syncSliderVisibility();
        this.sendBeaconToInject();
        showPaintNotice(
          enabled
            ? t("notice_beacon_on").replace(
                "{n}",
                String(getPaintBeaconThreshold()),
              )
            : t("notice_beacon_off"),
        );
      })();
    });

    // input 中は文言だけ更新し、確定 (change) で保存 + hint を出す
    slider.addEventListener("input", () => renderDesc(Number(slider.value)));
    slider.addEventListener("change", () => {
      void (async () => {
        await setPaintBeaconThreshold(Number(slider.value));
        const value = getPaintBeaconThreshold();
        slider.value = String(value);
        renderDesc(value);
        this.sendBeaconToInject();
        showPaintNotice(t("notice_beacon_on").replace("{n}", String(value)));
      })();
    });

    return fragment;
  }

  /** 「独立」モードでないときの警告枠 + 切替ボタン */
  private buildLayerModeWarning(): HTMLDivElement {
    const box = document.createElement("div");
    box.className = "pg-warn";

    const message = document.createElement("span");
    message.textContent = t("hint_requires_layer_mode");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "pg-warn-btn";
    button.textContent = t("hint_requires_layer_mode_action");
    button.addEventListener("click", () => {
      void (async () => {
        button.disabled = true;
        await setFrontTileLayer(true);
        // 「合成+最小機能」から来た場合に lite が残らないようにする
        if (getOverlayLightweightMode()) await setOverlayLightweightMode(false);
        window.postMessage(
          { source: "mr-wplace-front-tile-layer-update", enabled: true },
          "*",
        );
        location.reload();
      })();
    });

    box.append(message, button);
    return box;
  }

  private sendBeaconToInject(): void {
    window.postMessage(
      {
        source: "mr-wplace-paint-beacon-update",
        enabled: getPaintBeacon(),
        threshold: getPaintBeaconThreshold(),
      },
      "*",
    );
  }

  /** toolbar が paint panel 内 (画面下寄り) なら上方向、独立表示 (上部) なら下方向へ開く */
  private positionPanel(panel: HTMLDivElement): void {
    const anchor = this.button ?? getPaintToolbarContainer();
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const openUp = rect.top > window.innerHeight / 2;
    if (openUp) panel.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    else panel.style.top = `${rect.bottom + 6}px`;

    // 画面外にはみ出さないよう左右を寄せる
    const width = panel.offsetWidth;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    panel.style.left = `${left}px`;
  }

  private applyItemState(item: HTMLElement, enabled: boolean): void {
    item.classList.toggle("on", enabled);
    item.classList.toggle("off", !enabled);
    const state = item.querySelector(".pg-state");
    if (state) state.textContent = enabled ? "ON" : "OFF";
  }

  private async toggleKind(
    kind: PaintGuideKind,
    item: HTMLElement,
  ): Promise<void> {
    const enabled = !getPaintGuideKinds()[kind];
    await setPaintGuideKind(kind, enabled);
    this.applyItemState(item, enabled);
    showPaintNotice(t(KIND_NOTICE_KEY[kind][enabled ? 0 : 1]));
    window.postMessage(
      {
        source: "mr-wplace-paint-guide-update",
        enabled: getPaintGuide(),
        kinds: getPaintGuideKinds(),
      },
      "*",
    );
    console.log("🧑‍🎨 : Paint guide kind toggled:", kind, enabled);
  }

  private closePanel(): void {
    this.panel?.remove();
    this.panel = null;
    if (this.outsideHandler) {
      document.removeEventListener("pointerdown", this.outsideHandler, {
        capture: true,
      });
      this.outsideHandler = null;
    }
    if (this.button) setPaintToolbarButtonActive(this.button, getPaintGuide());
  }
}
