import { setupElementObserver } from "@/components/element-observer";
import {
  findMyLocationContainer,
  findPaintPixelControls,
} from "@/constants/selectors";
import { Toast } from "@/components/toast";
import { t } from "@/i18n/manager";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import {
  sendDraftModeToInject,
  sendDraftEraseModeToInject,
  requestDraftExport,
  requestDraftSeed,
  sendGalleryImagesToInject,
} from "@/core/bridge";
import { GalleryItem, GalleryStorage } from "@/states/galleryStorage";
import { getImageDataUrl } from "@/utils/indexed-db-bridge";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import {
  activateStickyFocusMode,
  deactivateFocusMode,
} from "@/features/focus-mode";

/**
 * 下書きモード (draft draw / blueprint)
 *
 * wplace のペイントモードには一切入らない。マップ上に重ねた独自レイヤー
 * (inject 側 draft-canvas) だけで完結し、実ペイントも charge 消費も起きない。
 *
 * 導線:
 *   マップ上の下書きFAB → 下書きモードON → 独自レイヤーが前面に出る
 *   → クリック/ドラッグで描画 → ツールバーから保存 / 終了
 */

const FAB_ID = "mr-wplace-draft-fab";
const TOOLBAR_ID = "mr-wplace-draft-toolbar";
/** 下書き保存で作られたギャラリー item。再保存で上書きする */
const SAVED_KEY_PREFIX = "draft-";

const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:calc(var(--spacing)*8);height:calc(var(--spacing)*8);"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>';

/** ブラシ色は wplace と同じ localStorage キーを共有する */
const SELECTED_COLOR_KEY = "selected-color";

export class DraftDraw {
  private enabled = false;
  private erasing = false;
  private pixelCount = 0;
  private saving = false;
  /** 保存済みギャラリーitemのkey。2回目以降は更新扱いにする */
  private savedKey: string | null = null;
  /** 下書き編集で開始した場合の元item。保存時にtitle等を引き継ぐ */
  private seedItem: GalleryItem | null = null;

  constructor() {
    this.init();
    activeInstance = this;
  }

  private init(): void {
    window.addEventListener("message", this.handleInjectMessage);

    setupElementObserver([
      {
        id: FAB_ID,
        // wplace のペイントUI中は出さない (競合を避ける)
        getTargetElement: () =>
          findPaintPixelControls() ? null : findMyLocationContainer(),
        createElement: (container) => {
          if (container.querySelector(`#${FAB_ID}`)) return;
          this.mountFab(container);
        },
      },
    ]);
  }

  private handleInjectMessage = (event: MessageEvent): void => {
    if (event.source !== window) return;
    const source = event.data?.source;

    if (source === "mr-wplace-draft-state") {
      this.enabled = !!event.data.enabled;
      this.pixelCount = event.data.pixelCount ?? 0;
      this.updateToolbar();
      return;
    }

    // spoit で色が変わったらスウォッチの選択表示を追従させる
    if (source === "mr-wplace-draft-color-picked") this.updateToolbar();
  };

  private mountFab(container: Element): void {
    const button = document.createElement("button");
    button.id = FAB_ID;
    button.type = "button";
    button.className =
      "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
    button.innerHTML = ICON_SVG;
    button.title = t`${"draft_mode"}`;
    button.addEventListener("click", () => this.enterDraftMode());

    container.className += " flex flex-col-reverse gap-1";
    button.style.order = "1";
    container.appendChild(button);

    this.syncFabAvailability();
  }

  /**
   * map instance が無いと座標変換ができず描画も保存もできないため無効化する。
   * 準備完了は非同期なので、押せるようになるまで定期的に見直す。
   */
  private syncFabAvailability(): void {
    const button = document.getElementById(FAB_ID) as HTMLButtonElement | null;
    if (!button) return;

    const ready = getMapInstanceReady();
    button.disabled = !ready;
    button.style.opacity = ready ? "" : "0.4";
    button.style.cursor = ready ? "" : "not-allowed";
    button.title = ready
      ? t`${"draft_mode"}`
      : `${t`${"draft_mode"}`} (${t`${"map_not_ready"}`})`;

    if (ready) return;
    window.setTimeout(() => this.syncFabAvailability(), 1000);
  }

  /**
   * 下書きモードON。独自レイヤーを立ち上げてツールバーを出すだけで、
   * wplace 側の状態は一切触らない。
   *
   * @param seedItem 指定時は下書き編集: 既存画像のピクセルを読み込み、
   *   保存時は新規作成ではなく同じ item を上書きする。
   */
  private enterDraftMode(seedItem?: GalleryItem): void {
    if (!getMapInstanceReady()) {
      Toast.show(t`${"map_not_ready"}`, "error");
      return;
    }
    if (this.enabled) return;

    this.savedKey = seedItem?.key ?? null;
    this.seedItem = seedItem ?? null;
    this.erasing = false;

    // 他の UI が邪魔になるので focus mode と同じ挙動 (#map を最前面へ) にする。
    // 下書き中はマップ上を連打するので、クリックで解除されない sticky 版を使う。
    activateStickyFocusMode();

    sendDraftModeToInject(true);
    this.enabled = true;
    this.renderToolbar();

    if (seedItem) void this.seedFromItem(seedItem);
  }

  private exitDraftMode(): void {
    sendDraftModeToInject(false);
    deactivateFocusMode();
    this.enabled = false;
    this.erasing = false;
    this.pixelCount = 0;
    this.savedKey = null;
    this.seedItem = null;
    document.getElementById(TOOLBAR_ID)?.remove();
  }

  /** 既存 gallery item のピクセルを下書きへ読み込む (下書き編集) */
  private async seedFromItem(item: GalleryItem): Promise<void> {
    if (!item.drawPosition) return;

    const dataUrl = await getImageDataUrl(item, {
      showToastOnError: true,
      logContext: "draft edit seed",
    });
    if (!dataUrl) return;

    await requestDraftSeed(dataUrl, item.drawPosition);
  }

  /**
   * 既存 gallery item を「下書き編集」として開く。
   * 座標が無い(未配置)画像は編集できない。
   *
   * NOTE: 通常の gotoMapPosition は navigation mode が URL の場合ページを
   * リロードしてしまい、直後の下書きモード起動が行えなくなる。
   * 下書き編集は map instance が生きていることが前提の機能なので、
   * ここでは常に flyTo (inject 側の smart navigation) を使う。
   */
  async enterDraftEditForItem(item: GalleryItem): Promise<void> {
    if (!getMapInstanceReady()) {
      Toast.show(t`${"map_not_ready"}`, "error");
      return;
    }
    if (!item.drawPosition) {
      Toast.show(t`${"draft_edit_needs_position"}`, "error");
      return;
    }

    const { TLX, TLY, PxX, PxY } = item.drawPosition;
    const { lat, lng } = tilePixelToLatLng(TLX, TLY, PxX, PxY);
    window.postMessage(
      { source: "mr-wplace-map-flyto", lat, lng, zoom: 14 },
      "*",
    );

    this.enterDraftMode(item);
  }

  // ------- toolbar -------

  /**
   * 下書き専用ツールバー。色選択 / 消しゴム / 保存 / 終了。
   * wplace の UI を借りないので、必要なものは全部ここに持つ。
   */
  private renderToolbar(): void {
    document.getElementById(TOOLBAR_ID)?.remove();

    const bar = document.createElement("div");
    bar.id = TOOLBAR_ID;
    bar.className =
      "bg-base-100 border-base-300 rounded-box fixed bottom-2 left-1/2 flex max-w-[96vw] -translate-x-1/2 flex-col gap-2 border p-2 shadow-xl";
    // focus mode が #map を z-index:1000 に上げるため、それより前に出す
    bar.style.zIndex = "1001";

    bar.appendChild(this.buildColorStrip());
    bar.appendChild(this.buildActionRow());
    bar.appendChild(this.buildHintRow());

    document.body.appendChild(bar);
    this.updateToolbar();
  }

  /** パレット。選択は localStorage 経由で inject 側の描画色になる */
  private buildColorStrip(): HTMLElement {
    const strip = document.createElement("div");
    strip.className = "flex max-h-24 flex-wrap gap-1 overflow-y-auto";

    for (const color of colorpalette) {
      if (color.id === TRANSPARENT_COLOR_ID) continue;

      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.dataset.colorId = String(color.id);
      swatch.title = color.name;
      swatch.className = "draft-swatch rounded-sm";
      swatch.style.cssText = `width:20px;height:20px;background:rgb(${color.rgb.join(",")});border:2px solid transparent;`;
      swatch.addEventListener("click", () => {
        localStorage.setItem(SELECTED_COLOR_KEY, String(color.id));
        this.erasing = false;
        sendDraftEraseModeToInject(false);
        this.updateToolbar();
      });
      strip.appendChild(swatch);
    }

    return strip;
  }

  private buildActionRow(): HTMLElement {
    const row = document.createElement("div");
    row.className = "flex items-center gap-2";

    const eraser = document.createElement("button");
    eraser.id = `${TOOLBAR_ID}-eraser`;
    eraser.type = "button";
    eraser.className = "btn btn-sm";
    eraser.textContent = t`${"draft_eraser"}`;
    eraser.addEventListener("click", () => {
      this.erasing = !this.erasing;
      sendDraftEraseModeToInject(this.erasing);
      this.updateToolbar();
    });

    const save = document.createElement("button");
    save.id = `${TOOLBAR_ID}-save`;
    save.type = "button";
    save.className = "btn btn-sm";
    save.style.cssText =
      "background:var(--color-warning); color:var(--color-warning-content);";
    save.addEventListener("click", () => void this.save());

    const close = document.createElement("button");
    close.type = "button";
    close.className = "btn btn-sm btn-ghost";
    close.textContent = t`${"close"}`;
    close.addEventListener("click", () => this.exitDraftMode());

    row.append(eraser, save, close);
    return row;
  }

  /**
   * 操作説明。記号 + マウス絵文字中心にして新規翻訳キーを増やさない。
   * (プロジェクト方針: UI は i18n surface を増やさない設計を優先)
   */
  private buildHintRow(): HTMLElement {
    const hint = document.createElement("div");
    hint.className = "text-base-content/60 text-center text-[10px] leading-tight";
    hint.textContent =
      "🖱️ = dot / drag = move / Space+drag = draw / 🖱️mid = spoit / 🖱️right = erase";
    return hint;
  }

  private updateToolbar(): void {
    const bar = document.getElementById(TOOLBAR_ID);
    if (!bar) return;

    if (!this.enabled) {
      bar.remove();
      return;
    }

    // 選択中スワッチの強調
    const selectedId = localStorage.getItem(SELECTED_COLOR_KEY);
    for (const el of bar.querySelectorAll<HTMLElement>(".draft-swatch"))
      el.style.borderColor =
        !this.erasing && el.dataset.colorId === selectedId
          ? "var(--color-primary)"
          : "transparent";

    const eraser = document.getElementById(
      `${TOOLBAR_ID}-eraser`,
    ) as HTMLButtonElement | null;
    if (eraser)
      eraser.className = `btn btn-sm${this.erasing ? " btn-primary" : ""}`;

    const save = document.getElementById(
      `${TOOLBAR_ID}-save`,
    ) as HTMLButtonElement | null;
    if (!save) return;

    save.disabled = this.saving || this.pixelCount === 0;
    save.style.opacity = save.disabled ? "0.6" : "1";
    const label = this.savedKey ? t`${"draft_update"}` : t`${"draft_save"}`;
    save.textContent = `${label}${this.pixelCount > 0 ? ` (${this.pixelCount})` : ""}`;
  }

  /** 下書きを gallery へ保存 (2回目以降は同じitemを更新) */
  private async save(): Promise<void> {
    if (this.saving || this.pixelCount === 0) return;
    this.saving = true;
    this.updateToolbar();

    try {
      const result = await requestDraftExport();
      if (!result) {
        Toast.show(t`${"draft_save_failed"}`, "error");
        return;
      }

      // 既存keyがあれば同じitemを上書き = 下書き画像の更新
      const key = this.savedKey ?? `${SAVED_KEY_PREFIX}${Date.now()}`;
      // 下書き編集(既存item)なら title 等を引き継ぐ。新規下書きなら生成する
      const title =
        this.seedItem?.title ||
        `${t`${"draft_mode"}`} ${new Date().toLocaleString()}`;
      await new GalleryStorage().save({
        ...this.seedItem,
        key,
        timestamp: Date.now(),
        dataUrl: result.dataUrl,
        title,
        drawPosition: result.coords,
        drawEnabled: true,
        width: result.width,
        height: result.height,
      });
      await sendGalleryImagesToInject();

      this.savedKey = key;
      Toast.show(t`${"saved_to_gallery"}`, "success");
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save draft:", error);
      Toast.show(t`${"draft_save_failed"}`, "error");
    } finally {
      this.saving = false;
      this.updateToolbar();
    }
  }
}

/** 実行中の DraftDraw インスタンス (initializer が1つだけ生成する) */
let activeInstance: DraftDraw | null = null;

/**
 * gallery 側から「下書き編集」を開始するための公開関数。
 * DraftDraw は DI に登録されていないため、モジュール直下の関数として公開する。
 */
export const enterDraftEditForItem = async (
  item: GalleryItem,
): Promise<void> => {
  if (!activeInstance) {
    Toast.show(t`${"draft_enter_failed"}`, "error");
    return;
  }
  await activeInstance.enterDraftEditForItem(item);
};
