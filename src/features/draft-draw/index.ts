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
  sendDraftBucketModeToInject,
  sendDraftBrushToInject,
  sendDraftLineToInject,
  sendDraftMapLockToInject,
  sendDraftUndoToInject,
  sendDraftRedoToInject,
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
import { IMG_ICON_BLUEPRINT } from "@/assets/iconImages";
import { showFeatureHint } from "@/features/feature-hints";

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
const HINT_ID = "mr-wplace-draft-hint";
const NOTICE_ID = "mr-wplace-draft-notice";
const CLOSE_ID = "mr-wplace-draft-close";
const COLOR_TIP_ID = "mr-wplace-draft-color-tip";
const COLOR_STRIP_ID = "mr-wplace-draft-colors";
const BRUSH_POPUP_ID = "mr-wplace-draft-brush-popup";
const LINE_POPUP_ID = "mr-wplace-draft-line-popup";
/** undo/redo FAB (画面左上に浮かせる) */
const HISTORY_ID = "mr-wplace-draft-history";

/** ブラシサイズの範囲 (inject 側 draft-brush.ts と揃える) */
const BRUSH_MIN_SIZE = 1;
const BRUSH_MAX_SIZE = 32;

/**
 * ディザリングスタイル。プレビューは 8x8 の格子を実際のマスク式で描いた
 * data-URI 無しの inline SVG。**文字を使わない**ので i18n も増えない。
 * mask は inject 側 draft-brush.ts の DITHER_MASKS と同じ式にする。
 */
type DitherStyle =
  | "solid"
  | "checker"
  | "dots25"
  | "sparse"
  | "hline"
  | "diagonal";

const DITHER_MASKS: Record<DitherStyle, (x: number, y: number) => boolean> = {
  solid: () => true,
  checker: (x, y) => ((x + y) & 1) === 0,
  dots25: (x, y) => (x & 1) === 0 && (y & 1) === 0,
  sparse: (x, y) => (x & 3) === 0 && (y & 3) === 0,
  hline: (_x, y) => (y & 1) === 0,
  diagonal: (x, y) => (x + y) % 3 === 0,
};

const DITHER_STYLES = Object.keys(DITHER_MASKS) as DitherStyle[];

/** スタイルの見た目をそのまま 8x8 のドット絵で示す (文字なし) */
const buildDitherPreviewSvg = (style: DitherStyle): string => {
  const mask = DITHER_MASKS[style];
  let rects = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (mask(x, y)) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="20" height="20" fill="currentColor" shape-rendering="crispEdges">${rects}</svg>`;
};

/**
 * パレットの行数まわり。**行数**を 2-8 に収め、列は横幅ぶん好きなだけ使う。
 * 色数は固定なので「行数 = ceil(色数 / 列数)」。列数を横幅から決めれば
 * 行数が決まるので、行が 8 を超えないだけの列数を下限として要求する。
 */
const COLOR_MIN_ROWS = 2;
const COLOR_MAX_ROWS = 8;
/** スウォッチの下限/上限。狭い画面で潰れず、広い画面で巨大化しないように */
const COLOR_SWATCH_MIN_PX = 22;
const COLOR_SWATCH_MAX_PX = 40;

/**
 * ツールバーアイコン (lucide)。`stroke="currentColor"` なので
 * theme の文字色に追従する。
 */
const ICON_ATTRS =
  'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ERASER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/></svg>`;
const BRUSH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="m16 22-1-4"/><path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"/><path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z"/><path d="m8 22 1-4"/></svg>`;
/** マップロック。ON = 左ドラッグが pan ではなく描画になる */
const LOCK_OPEN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
const LOCK_CLOSED_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const UNDO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
const REDO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;
const BUCKET_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M11 7 6 2"/><path d="M18.992 12H2.041"/><path d="M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595"/><path d="m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33"/></svg>`;
/** User-provided Lucide spline icon. */
const LINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></svg>`;
const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="m20 6-11 11-5-5"/></svg>`;
const X_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
/** 下書き保存で作られたギャラリー item。再保存で上書きする */
const SAVED_KEY_PREFIX = "draft-";

const ICON_SVG = `<img src="${IMG_ICON_BLUEPRINT}"  style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">`;

/** ブラシ色は wplace と同じ localStorage キーを共有する */
const SELECTED_COLOR_KEY = "selected-color";

export class DraftDraw {
  private enabled = false;
  private erasing = false;
  private bucket = false;
  private pixelCount = 0;
  private saving = false;
  /** 保存済みギャラリーitemのkey。2回目以降は更新扱いにする */
  private savedKey: string | null = null;
  /** 最後に保存した時点の pixelCount。未保存変更の判定に使う */
  private savedPixelCount = 0;
  /** 下書き編集で開始した場合の元item。保存時にtitle等を引き継ぐ */
  private seedItem: GalleryItem | null = null;
  /** ブラシ設定。形状は常に円で、変えられるのはサイズとディザだけ */
  private brushSize = 1;
  private ditherStyle: DitherStyle = "solid";
  /** マップロック。ON の間は左ドラッグが pan ではなく描画になる */
  private mapLocked = false;
  /** undo/redo の可否 (inject の履歴スタック由来) */
  private canUndo = false;
  private canRedo = false;
  /** 確定前は端点/制御点を動かせるベクター線ツール */
  private lineMode = false;
  private lineInnerWidth = 2;
  private lineOutlineWidth = 1;
  private lineInnerColorId = 10; // Yellow
  private lineOutlineColorId = 9; // Gold
  private lineColorTarget: "inner" | "outline" = "inner";

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
      this.canUndo = !!event.data.canUndo;
      this.canRedo = !!event.data.canRedo;
      this.updateToolbar();
      return;
    }

    // spoit で色が変わったらスウォッチの選択表示を追従させる
    if (source === "mr-wplace-draft-color-picked") this.updateToolbar();

    if (source === "mr-wplace-draft-line-ended") {
      this.lineMode = false;
      this.closeLinePopup();
      this.updateToolbar();
      return;
    }

    if (source === "mr-wplace-draft-bucket-too-large") this.showBucketHint();
  };

  /**
   * バケツが広すぎて中止された時のヒント。
   * トーストは使わない方針なので、画面端に控えめに出して自動で消す。
   */
  private showBucketHint(): void {
    document.getElementById(NOTICE_ID)?.remove();

    const notice = document.createElement("div");
    notice.id = NOTICE_ID;
    notice.className =
      "bg-warning text-warning-content rounded-box pointer-events-none fixed top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 text-xs shadow-lg";
    notice.style.zIndex = "1002";
    notice.textContent = t`${"draft_bucket_too_large"}`;
    document.body.appendChild(notice);

    window.setTimeout(() => notice.remove(), 2500);
  }

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
    showFeatureHint("draft-fab-btn", button);
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
    this.lineMode = false;
    this.mapLocked = false;

    // 他の UI が邪魔になるので focus mode と同じ挙動 (#map を最前面へ) にする。
    // 下書き中はマップ上を連打するので、クリックで解除されない sticky 版を使う。
    activateStickyFocusMode();

    sendDraftModeToInject(true);
    // inject 側の設定は module 単位で残るので、毎回明示的に揃える
    sendDraftBrushToInject({
      size: this.brushSize,
      ditherStyle: this.ditherStyle,
    });
    sendDraftMapLockToInject(this.mapLocked);
    this.enabled = true;
    this.renderToolbar();

    if (seedItem) void this.seedFromItem(seedItem);
  }

  private exitDraftMode(): void {
    sendDraftModeToInject(false);
    deactivateFocusMode();
    this.enabled = false;
    this.erasing = false;
    this.bucket = false;
    this.lineMode = false;
    this.mapLocked = false;
    this.pixelCount = 0;
    this.savedKey = null;
    this.savedPixelCount = 0;
    this.seedItem = null;
    this.canUndo = false;
    this.canRedo = false;
    document.getElementById(TOOLBAR_ID)?.remove();
    document.getElementById(HINT_ID)?.remove();
    document.getElementById(NOTICE_ID)?.remove();
    document.getElementById(CLOSE_ID)?.remove();
    document.getElementById(HISTORY_ID)?.remove();
    this.hideColorTip();
    this.closeBrushPopup();
    this.closeLinePopup();
    window.removeEventListener("resize", this.handleResize);
  }

  /** 既存 gallery item のピクセルを下書きへ読み込む (下書き編集) */
  private async seedFromItem(item: GalleryItem): Promise<void> {
    if (!item.drawPosition) return;

    const dataUrl = await getImageDataUrl(item, {
      showToastOnError: true,
      logContext: "draft edit seed",
    });
    if (!dataUrl) return;

    const seeded = await requestDraftSeed(dataUrl, item.drawPosition);
    // seed 直後の状態は「保存済みの内容そのもの」なので未保存変更に数えない
    this.savedPixelCount = seeded;
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
   * 下書き専用ツールバー。色選択 / 消しゴム / バケツ / 保存 / 終了。
   * wplace の UI を借りないので、必要なものは全部ここに持つ。
   *
   * bottom sheet 方式: 画面下辺に密着させ、左右いっぱいに広げる。
   * モバイル/タブレットで左右マージンがあると地図を隠して邪魔になるため。
   * 操作説明は sheet の「外・上」に置く (地図の上に薄く重なるだけ)。
   */
  private renderToolbar(): void {
    document.getElementById(TOOLBAR_ID)?.remove();

    const sheet = document.createElement("div");
    sheet.id = TOOLBAR_ID;
    // 色は theme 変数で拾う (固定色は使わない)。レイアウトは inline style。
    // focus mode が #map を z-index:1000 に上げるため、それより前に出す
    sheet.style.cssText = [
      "position:fixed;right:0;bottom:0;left:0;z-index:1001",
      "display:flex;flex-direction:column;gap:8px",
      "padding:8px 12px calc(env(safe-area-inset-bottom, 0px) + 8px)",
      "background:var(--color-base-100)",
      "border-top:1px solid var(--color-base-300)",
      "border-top-left-radius:1rem;border-top-right-radius:1rem",
      "box-shadow:0 -4px 12px rgb(0 0 0 / 0.15)",
    ].join(";");

    sheet.appendChild(this.buildColorStrip());
    sheet.appendChild(this.buildActionRow());

    document.body.appendChild(sheet);
    // 操作説明と閉じるボタンは sheet の「外」。実高さを測って追従させる
    document.body.appendChild(this.buildHintRow());
    document.getElementById(CLOSE_ID)?.remove();
    document.body.appendChild(this.buildCloseButton());
    document.getElementById(HISTORY_ID)?.remove();
    document.body.appendChild(this.buildHistoryFab());

    // 幅が変わると列数もスウォッチサイズも変わるので追従させる
    window.addEventListener("resize", this.handleResize);

    this.layoutColorStrip();
    this.positionOverlays();
    this.updateToolbar();
  }

  /** 画面幅の変化に合わせてパレット列数と外側要素の位置を組み直す */
  private handleResize = (): void => {
    this.layoutColorStrip();
    this.positionOverlays();
  };

  /**
   * sheet の外に置いた要素 (操作説明 / 閉じるボタン) を sheet の直上へ配置する。
   * sheet の高さは内容 (ボタン文言) で変わるため毎回実測する。
   *
   * 閉じるボタンは操作説明と**同じ段**に置く (右端に丸バツ)。
   * hint は中央寄せの text なので、右端のボタンとは重ならない。
   */
  private positionOverlays(): void {
    const sheet = document.getElementById(TOOLBAR_ID);
    if (!sheet) return;
    const sheetHeight = sheet.offsetHeight;

    const close = document.getElementById(CLOSE_ID);
    const closeHeight = close?.offsetHeight ?? 0;
    // 丸ボタンの方が背が高いので、その中心に text を合わせる
    if (close) close.style.bottom = `${sheetHeight + 4}px`;

    const hint = document.getElementById(HINT_ID);
    if (hint)
      hint.style.bottom = `${sheetHeight + 4 + Math.max((closeHeight - hint.offsetHeight) / 2, 0)}px`;
  }

  /**
   * パレット。選択は localStorage 経由で inject 側の描画色になる。
   *
   * レイアウト: **行数を 2-8 に収める**。列は横幅ぶん好きなだけ使ってよい。
   * 色数は固定なので列数から行数が決まる。横幅に収まる列数を出したうえで、
   * 「8行を超えない最小列数」を下限、「2行を下回らない最大列数」を上限にする。
   * これで縦スクロールが不要になり、地図を隠す高さにもならない。
   *
   * NOTE: 拡張機能なので Tailwind のユーティリティが効かない場面がある。
   * レイアウトは class ではなく **inline style** で組む。
   */
  private buildColorStrip(): HTMLElement {
    const strip = document.createElement("div");
    strip.id = COLOR_STRIP_ID;
    strip.style.cssText =
      "display:grid;gap:4px;margin:0 auto;justify-content:center;";

    for (const color of colorpalette) {
      if (color.id === TRANSPARENT_COLOR_ID) continue;

      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.dataset.colorId = String(color.id);
      swatch.dataset.colorName = color.name;
      swatch.className = "draft-swatch";
      // 正方形。実サイズは layoutColorStrip が列数と一緒に決める
      swatch.style.cssText = `aspect-ratio:1;border-radius:2px;background:rgb(${color.rgb.join(",")});border:2px solid transparent;padding:0;cursor:pointer;`;
      swatch.addEventListener("click", () => {
        localStorage.setItem(SELECTED_COLOR_KEY, String(color.id));
        // 色を選んだら描画に戻す (バケツは色選択後も使いたいので維持)
        this.erasing = false;
        sendDraftEraseModeToInject(false);
        this.updateToolbar();
      });
      swatch.addEventListener("pointerenter", () =>
        this.showColorTip(swatch, color.name),
      );
      swatch.addEventListener("pointerleave", () => this.hideColorTip());
      strip.appendChild(swatch);
    }

    // スウォッチから離れる/選び直す時に吹き出しが残らないようにする
    strip.addEventListener("pointerleave", () => this.hideColorTip());
    return strip;
  }

  /**
   * パレットの列数とスウォッチサイズを実幅から決める。
   *
   * 行数を 2-8 に収めたいので、色数 n に対して
   *   - 8行以内にするための最小列数 = ceil(n / 8)
   *   - 2行を割らないための最大列数 = ceil(n / 2)
   * の範囲で、実幅に収まる最大の列数を選ぶ。
   * 列が決まればスウォッチ幅は「余白を除いた幅 / 列数」で確定する。
   */
  private layoutColorStrip(): void {
    const strip = document.getElementById(COLOR_STRIP_ID);
    const sheet = document.getElementById(TOOLBAR_ID);
    if (!strip || !sheet) return;

    const count = strip.childElementCount;
    if (!count) return;

    const gap = 4;
    // sheet の左右 padding (12px * 2) を引いた実利用可能幅
    const available = Math.max(sheet.clientWidth - 24, COLOR_SWATCH_MIN_PX);

    const minCols = Math.ceil(count / COLOR_MAX_ROWS);
    const maxCols = Math.ceil(count / COLOR_MIN_ROWS);
    // 最小スウォッチ幅で何列入るか → 行数制約でクランプ
    const fitCols = Math.floor((available + gap) / (COLOR_SWATCH_MIN_PX + gap));
    const cols = Math.max(minCols, Math.min(fitCols, maxCols));

    // 列が決まったら余白を分け合う。広すぎる画面で巨大化しないよう上限を掛ける
    const size = Math.min(
      Math.floor((available - gap * (cols - 1)) / cols),
      COLOR_SWATCH_MAX_PX,
    );

    strip.style.gridTemplateColumns = `repeat(${cols},${size}px)`;
  }

  /**
   * 色名の吹き出し。hover で即座に出す (title 属性のような遅延を避ける)。
   * 要素は1つを使い回し、位置と文言だけ差し替える。
   */
  private showColorTip(swatch: HTMLElement, name: string): void {
    let tip = document.getElementById(COLOR_TIP_ID);
    if (!tip) {
      tip = document.createElement("div");
      tip.id = COLOR_TIP_ID;
      tip.style.cssText = [
        "position:fixed;z-index:1003;pointer-events:none",
        "padding:2px 8px;border-radius:6px",
        "background:var(--color-neutral);color:var(--color-neutral-content)",
        "font-size:12px;line-height:1.4;white-space:nowrap",
        "box-shadow:0 2px 8px rgb(0 0 0 / 0.2)",
      ].join(";");
      document.body.appendChild(tip);
    }

    // 先に文言を入れてから測る (サイズが文字数で変わるため)
    tip.textContent = name;
    const rect = swatch.getBoundingClientRect();
    const { offsetWidth: tipW, offsetHeight: tipH } = tip;
    // スウォッチの真上・中央。画面端でははみ出さないよう clamp する
    tip.style.top = `${rect.top - tipH - 6}px`;
    tip.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - tipW / 2, 4), window.innerWidth - tipW - 4)}px`;
  }

  private hideColorTip(): void {
    document.getElementById(COLOR_TIP_ID)?.remove();
  }

  /** 保存 / 消しゴム / バケツ を横一列で中央寄せ */
  private buildActionRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;align-items:center;justify-content:center;gap:8px;";

    const eraser = document.createElement("button");
    eraser.id = `${TOOLBAR_ID}-eraser`;
    eraser.type = "button";
    eraser.className = "btn btn-sm btn-square";
    eraser.innerHTML = ERASER_ICON_SVG;
    eraser.title = t`${"draft_eraser"}`;
    eraser.addEventListener("click", () => {
      if (this.lineMode) this.finishLineTool("cancel");
      this.erasing = !this.erasing;
      // 排他: バケツとは同時に使えない
      if (this.erasing) this.bucket = false;
      sendDraftEraseModeToInject(this.erasing);
      sendDraftBucketModeToInject(this.bucket);
      this.updateToolbar();
    });

    const brush = document.createElement("button");
    brush.id = `${TOOLBAR_ID}-brush`;
    brush.type = "button";
    brush.className = "btn btn-sm btn-square";
    brush.innerHTML = BRUSH_ICON_SVG;
    brush.title = t`${"draft_brush"}`;
    brush.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.lineMode) this.finishLineTool("cancel");
      this.closeLinePopup();
      this.toggleBrushPopup();
    });

    const line = document.createElement("button");
    line.id = `${TOOLBAR_ID}-line`;
    line.type = "button";
    line.className = "btn btn-sm btn-square";
    line.innerHTML = LINE_ICON_SVG;
    line.title = "Line";
    line.setAttribute("aria-label", "Line");
    line.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.lineMode) this.activateLineTool();
      else this.toggleLinePopup();
    });

    // マップロック: ON にすると左ドラッグが pan ではなく描画になる
    const lock = document.createElement("button");
    lock.id = `${TOOLBAR_ID}-lock`;
    lock.type = "button";
    lock.className = "btn btn-sm btn-square";
    lock.innerHTML = LOCK_OPEN_ICON_SVG;
    lock.title = t`${"draft_map_lock"}`;
    lock.addEventListener("click", () => {
      this.mapLocked = !this.mapLocked;
      sendDraftMapLockToInject(this.mapLocked);
      this.updateToolbar();
    });

    const bucket = document.createElement("button");
    bucket.id = `${TOOLBAR_ID}-bucket`;
    bucket.type = "button";
    bucket.className = "btn btn-sm btn-square";
    bucket.innerHTML = BUCKET_ICON_SVG;
    bucket.title = t`${"draft_bucket"}`;
    bucket.addEventListener("click", () => {
      if (this.lineMode) this.finishLineTool("cancel");
      this.bucket = !this.bucket;
      if (this.bucket) this.erasing = false;
      sendDraftBucketModeToInject(this.bucket);
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

    // 閉じるは sheet の外 (右上の丸バツ) なのでここには入れない
    row.append(save, lock, brush, line, eraser, bucket);
    return row;
  }

  // ------- line tool -------

  private getLineColor(id: number): (typeof colorpalette)[number] {
    return colorpalette.find((color) => color.id === id) ?? colorpalette[0];
  }

  /** A curved road sample communicates width, outline and both colours. */
  private buildLinePreviewSvg(): string {
    const inner = this.getLineColor(this.lineInnerColorId);
    const outline = this.getLineColor(this.lineOutlineColorId);
    const innerWidth = Math.min(10, 2 + this.lineInnerWidth * 0.25);
    const outlineWidth =
      innerWidth + Math.min(12, this.lineOutlineWidth * 0.8) * 2;
    const path = "M8 27 Q52 2 112 21";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 34" width="120" height="34" fill="none" style="display:block">${
      this.lineOutlineWidth > 0
        ? `<path d="${path}" stroke="rgb(${outline.rgb.join(",")})" stroke-width="${outlineWidth}" stroke-linecap="round"/>`
        : ""
    }<path d="${path}" stroke="rgb(${inner.rgb.join(",")})" stroke-width="${innerWidth}" stroke-linecap="round"/></svg>`;
  }

  private activateLineTool(): void {
    this.closeBrushPopup();
    this.erasing = false;
    this.bucket = false;
    this.lineMode = true;
    sendDraftEraseModeToInject(false);
    sendDraftBucketModeToInject(false);
    sendDraftLineToInject({
      enabled: true,
      innerWidth: this.lineInnerWidth,
      outlineWidth: this.lineOutlineWidth,
      innerColorId: this.lineInnerColorId,
      outlineColorId: this.lineOutlineColorId,
    });
    this.updateToolbar();
    this.openLinePopup();
  }

  private finishLineTool(command: "commit" | "cancel"): void {
    if (!this.lineMode) return;
    sendDraftLineToInject({ command });
    this.lineMode = false;
    this.closeLinePopup();
    this.updateToolbar();
  }

  private toggleLinePopup(): void {
    if (document.getElementById(LINE_POPUP_ID)) this.closeLinePopup();
    else this.openLinePopup();
  }

  private openLinePopup(): void {
    this.closeLinePopup();
    const anchor = document.getElementById(`${TOOLBAR_ID}-line`);
    if (!anchor) return;

    const popup = document.createElement("div");
    popup.id = LINE_POPUP_ID;
    popup.style.cssText = [
      "position:fixed;z-index:1004",
      "display:flex;flex-direction:column;gap:8px",
      "width:min(340px,calc(100vw - 16px));max-height:min(440px,calc(100vh - 180px));overflow:auto",
      "padding:10px;border-radius:12px",
      "background:var(--color-base-100)",
      "border:1px solid var(--color-base-300)",
      "color:var(--color-base-content)",
      "box-shadow:0 4px 16px rgb(0 0 0 / 0.25)",
    ].join(";");
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());
    popup.addEventListener("click", (e) => e.stopPropagation());

    const preview = document.createElement("div");
    preview.id = `${LINE_POPUP_ID}-preview`;
    preview.style.cssText =
      "display:flex;align-items:center;justify-content:center;height:40px;border-radius:8px;background:var(--color-base-200);";
    preview.innerHTML = this.buildLinePreviewSvg();
    popup.append(preview);
    popup.append(this.buildLineWidthControl("inner"));
    popup.append(this.buildLineWidthControl("outline"));
    popup.append(this.buildLineColorChannels());
    popup.append(this.buildLinePalette());

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:flex-end;gap:8px;";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-sm btn-square";
    cancel.innerHTML = X_ICON_SVG;
    cancel.title = "Cancel";
    cancel.addEventListener("click", () => this.finishLineTool("cancel"));
    const commit = document.createElement("button");
    commit.type = "button";
    commit.className = "btn btn-sm btn-square btn-primary";
    commit.innerHTML = CHECK_ICON_SVG;
    commit.title = "Apply";
    commit.addEventListener("click", () => this.finishLineTool("commit"));
    actions.append(cancel, commit);
    popup.append(actions);

    document.body.appendChild(popup);
    const rect = anchor.getBoundingClientRect();
    popup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    popup.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - popup.offsetWidth / 2, 8), window.innerWidth - popup.offsetWidth - 8)}px`;
    window.addEventListener("pointerdown", this.handleOutsideLineClick, {
      capture: true,
    });
    this.syncLinePopup();
  }

  private buildLineWidthControl(kind: "inner" | "outline"): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";
    const icon = document.createElement("span");
    icon.style.cssText = "display:flex;width:28px;justify-content:center;";
    icon.innerHTML =
      kind === "inner"
        ? `<svg ${ICON_ATTRS}><path d="M3 12h18" stroke-width="5"/></svg>`
        : `<svg ${ICON_ATTRS}><path d="M3 12h18" stroke-width="8"/><path d="M3 12h18" stroke="var(--color-base-100)" stroke-width="3"/></svg>`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = kind === "inner" ? "1" : "0";
    slider.max = kind === "inner" ? "32" : "16";
    slider.value = String(
      kind === "inner" ? this.lineInnerWidth : this.lineOutlineWidth,
    );
    slider.className = "range range-xs";
    slider.style.cssText = "flex:1;min-width:0;";
    slider.addEventListener("input", () => {
      const value = Number(slider.value);
      if (kind === "inner") this.lineInnerWidth = value;
      else this.lineOutlineWidth = value;
      sendDraftLineToInject(
        kind === "inner" ? { innerWidth: value } : { outlineWidth: value },
      );
      this.syncLinePopup();
    });
    row.append(icon, slider);
    return row;
  }

  private buildLineColorChannels(): HTMLElement {
    const row = document.createElement("div");
    row.id = `${LINE_POPUP_ID}-channels`;
    row.style.cssText = "display:flex;justify-content:center;gap:10px;";
    for (const kind of ["outline", "inner"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.lineColorTarget = kind;
      button.className = "btn btn-sm btn-square";
      button.addEventListener("click", () => {
        this.lineColorTarget = kind;
        this.syncLinePopup();
      });
      row.append(button);
    }
    return row;
  }

  private buildLinePalette(): HTMLElement {
    const palette = document.createElement("div");
    palette.style.cssText =
      "display:grid;grid-template-columns:repeat(9,1fr);gap:4px;";
    for (const color of colorpalette) {
      if (color.id === TRANSPARENT_COLOR_ID) continue;
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.dataset.lineColorId = String(color.id);
      swatch.style.cssText = `aspect-ratio:1;min-width:0;border-radius:3px;background:rgb(${color.rgb.join(",")});border:2px solid transparent;padding:0;cursor:pointer;`;
      swatch.title = color.name;
      swatch.addEventListener("click", () => {
        if (this.lineColorTarget === "inner") this.lineInnerColorId = color.id;
        else this.lineOutlineColorId = color.id;
        sendDraftLineToInject(
          this.lineColorTarget === "inner"
            ? { innerColorId: color.id }
            : { outlineColorId: color.id },
        );
        this.syncLinePopup();
      });
      palette.append(swatch);
    }
    return palette;
  }

  private syncLinePopup(): void {
    const preview = document.getElementById(`${LINE_POPUP_ID}-preview`);
    if (preview) preview.innerHTML = this.buildLinePreviewSvg();

    for (const button of document.querySelectorAll<HTMLElement>(
      `[data-line-color-target]`,
    )) {
      const kind = button.dataset.lineColorTarget as "inner" | "outline";
      const color = this.getLineColor(
        kind === "inner" ? this.lineInnerColorId : this.lineOutlineColorId,
      );
      button.className = `btn btn-sm btn-square${kind === this.lineColorTarget ? " btn-primary" : ""}`;
      button.title = color.name;
      button.innerHTML =
        kind === "inner"
          ? `<span style="width:20px;height:20px;border-radius:999px;background:rgb(${color.rgb.join(",")});border:1px solid rgb(0 0 0 / .35)"></span>`
          : `<span style="width:20px;height:20px;border-radius:999px;background:rgb(${color.rgb.join(",")});padding:5px"><span style="display:block;width:100%;height:100%;border-radius:999px;background:var(--color-base-100)"></span></span>`;
    }

    const selectedId =
      this.lineColorTarget === "inner"
        ? this.lineInnerColorId
        : this.lineOutlineColorId;
    for (const swatch of document.querySelectorAll<HTMLElement>(
      `[data-line-color-id]`,
    ))
      swatch.style.borderColor =
        Number(swatch.dataset.lineColorId) === selectedId
          ? "var(--color-primary)"
          : "transparent";
  }

  private handleOutsideLineClick = (event: Event): void => {
    const popup = document.getElementById(LINE_POPUP_ID);
    const target = event.target;
    if (popup && target instanceof Node && popup.contains(target)) return;
    if (
      target instanceof Node &&
      document.getElementById(`${TOOLBAR_ID}-line`)?.contains(target)
    )
      return;
    this.closeLinePopup();
  };

  private closeLinePopup(): void {
    document.getElementById(LINE_POPUP_ID)?.remove();
    window.removeEventListener("pointerdown", this.handleOutsideLineClick, {
      capture: true,
    });
  }

  // ------- brush popup -------

  /**
   * ブラシ設定ポップアップ。ブラシボタンの直上に出す。
   * サイズ (slider + 数値) と ディザリングスタイル (視覚ボタン) を1つに収める。
   * 形状は常に円なので、形状の選択肢は置かない。
   */
  private toggleBrushPopup(): void {
    if (document.getElementById(BRUSH_POPUP_ID)) {
      this.closeBrushPopup();
      return;
    }

    const anchor = document.getElementById(`${TOOLBAR_ID}-brush`);
    if (!anchor) return;

    const popup = document.createElement("div");
    popup.id = BRUSH_POPUP_ID;
    popup.style.cssText = [
      "position:fixed;z-index:1004",
      "display:flex;flex-direction:column;gap:8px",
      "padding:10px;border-radius:12px;min-width:200px",
      "background:var(--color-base-100)",
      "border:1px solid var(--color-base-300)",
      "color:var(--color-base-content)",
      "box-shadow:0 4px 16px rgb(0 0 0 / 0.25)",
    ].join(";");
    // 下のマップへ操作が抜けて誤爆で塗られるのを防ぐ
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());
    popup.addEventListener("click", (e) => e.stopPropagation());

    popup.appendChild(this.buildBrushSizeRow());
    popup.appendChild(this.buildDitherStyleRow());

    document.body.appendChild(popup);

    // ブラシボタンの真上・中央。画面端でははみ出さないよう clamp する
    const rect = anchor.getBoundingClientRect();
    popup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    popup.style.left = `${Math.min(Math.max(rect.left + rect.width / 2 - popup.offsetWidth / 2, 8), window.innerWidth - popup.offsetWidth - 8)}px`;

    // 外側をクリックしたら閉じる (capture で map より先に拾う)
    window.addEventListener("pointerdown", this.handleOutsideBrushClick, {
      capture: true,
    });
  }

  /**
   * 外側クリックでのみ閉じる。
   *
   * NOTE: この listener は **capture 段階** なので popup 自身より先に走る。
   * つまり popup 側の stopPropagation では止められない (それに頼ると
   * slider やスタイルボタンを押した瞬間に閉じてしまい、操作できなくなる)。
   * 判定は伝播ではなく **target が popup の内側か** で行うこと。
   */
  private handleOutsideBrushClick = (event: Event): void => {
    const popup = document.getElementById(BRUSH_POPUP_ID);
    const target = event.target;
    if (popup && target instanceof Node && popup.contains(target)) return;
    // ブラシボタン自身は toggle 側に任せる (ここで閉じると二重で開き直る)
    if (
      target instanceof Node &&
      document.getElementById(`${TOOLBAR_ID}-brush`)?.contains(target)
    )
      return;

    this.closeBrushPopup();
  };

  private closeBrushPopup(): void {
    document.getElementById(BRUSH_POPUP_ID)?.remove();
    window.removeEventListener("pointerdown", this.handleOutsideBrushClick, {
      capture: true,
    });
  }

  /** サイズ: slider + 現在値。default は 1px */
  private buildBrushSizeRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";

    const label = document.createElement("span");
    label.style.cssText = "font-size:11px;opacity:0.7;white-space:nowrap;";
    label.textContent = t`${"size_reduction"}`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(BRUSH_MIN_SIZE);
    slider.max = String(BRUSH_MAX_SIZE);
    slider.value = String(this.brushSize);
    slider.className = "range range-xs";
    slider.style.cssText = "flex:1;min-width:0;";

    const value = document.createElement("span");
    value.style.cssText =
      "font-size:12px;min-width:34px;text-align:right;white-space:nowrap;";
    value.textContent = `${this.brushSize}px`;

    slider.addEventListener("input", () => {
      this.brushSize = Number(slider.value);
      value.textContent = `${this.brushSize}px`;
      sendDraftBrushToInject({ size: this.brushSize });
    });

    row.append(label, slider, value);
    return row;
  }

  /**
   * ディザリングスタイル。文字は使わず、実際のマスクを 8x8 のドット絵にして並べる
   * (プロジェクト方針: UI は i18n surface を増やさない設計を優先)。
   */
  private buildDitherStyleRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:6px;justify-content:space-between;";

    for (const style of DITHER_STYLES) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.ditherStyle = style;
      button.className = "btn btn-xs btn-square";
      button.style.cssText = "flex:1;padding:0;";
      button.innerHTML = buildDitherPreviewSvg(style);
      button.addEventListener("click", () => {
        this.ditherStyle = style;
        sendDraftBrushToInject({ ditherStyle: style });
        this.syncDitherSelection(row);
      });
      row.appendChild(button);
    }

    this.syncDitherSelection(row);
    return row;
  }

  /** NOTE: btn-square を落とすとアイコンが潰れるので必ず維持する */
  private syncDitherSelection(row: HTMLElement): void {
    for (const el of row.querySelectorAll<HTMLElement>("[data-dither-style]"))
      el.className = `btn btn-xs btn-square${el.dataset.ditherStyle === this.ditherStyle ? " btn-primary" : ""}`;
  }

  /**
   * 閉じるボタン。sheet の**外・右上**に丸バツで浮かせ、操作説明と同じ段に並べる。
   * sheet 内に置くと保存ボタンの隣で誤爆しやすいため、物理的に離す。
   * 位置は sheet の実高さに追従させる (`positionOverlays`)。
   */
  private buildCloseButton(): HTMLElement {
    const close = document.createElement("button");
    close.id = CLOSE_ID;
    close.type = "button";
    close.style.cssText = [
      "position:fixed;right:12px;z-index:1002",
      "display:flex;align-items:center;justify-content:center",
      "width:32px;height:32px;padding:0",
      "border-radius:9999px;cursor:pointer",
      "background:var(--color-base-100)",
      "border:1px solid var(--color-base-300)",
      "color:var(--color-base-content)",
      "font-size:14px;line-height:1",
      "box-shadow:0 2px 8px rgb(0 0 0 / 0.2)",
    ].join(";");
    close.textContent = "✕";
    close.title = t`${"close"}`;
    close.addEventListener("click", () => this.requestExit());
    return close;
  }

  /**
   * undo / redo。**画面全体の左上**に fab として浮かせる (sheet の外)。
   * アイコンのみ (文字を持たないので i18n surface も増えない)。
   * 履歴本体は inject 側にあるので、ここは要求を送るだけ。
   */
  private buildHistoryFab(): HTMLElement {
    const group = document.createElement("div");
    group.id = HISTORY_ID;
    group.style.cssText = [
      "position:fixed;top:12px;left:12px;z-index:1002",
      "display:flex;gap:6px",
    ].join(";");

    const build = (
      id: string,
      icon: string,
      onClick: () => void,
    ): HTMLButtonElement => {
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "btn btn-sm btn-square shadow-md";
      button.innerHTML = icon;
      button.addEventListener("click", onClick);
      return button;
    };

    group.append(
      build(`${HISTORY_ID}-undo`, UNDO_ICON_SVG, () => sendDraftUndoToInject()),
      build(`${HISTORY_ID}-redo`, REDO_ICON_SVG, () => sendDraftRedoToInject()),
    );
    return group;
  }

  /** 履歴スタックの有無でボタンの活性を切り替える */
  private syncHistoryFab(): void {
    const sync = (id: string, usable: boolean): void => {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      if (!button) return;
      button.disabled = !usable;
      button.style.opacity = usable ? "" : "0.4";
      button.style.cursor = usable ? "" : "not-allowed";
    };

    sync(`${HISTORY_ID}-undo`, this.canUndo);
    sync(`${HISTORY_ID}-redo`, this.canRedo);
  }

  /**
   * 未保存の変更があるなら確認してから閉じる。
   * 下書きは保存しない限り全部消えるので、事故防止に simple confirm を挟む。
   */
  private requestExit(): void {
    if (this.hasUnsavedChanges() && !confirm(t`${"draft_discard_confirm"}`))
      return;
    this.exitDraftMode();
  }

  /**
   * 「保存後に描き足したか」で判定する。
   * pixelCount は inject から届く現在の下書きピクセル数なので、
   * 最後に保存した時点の数と違えば未保存の変更あり扱いにする。
   */
  private hasUnsavedChanges(): boolean {
    return (
      this.lineMode || (this.pixelCount > 0 && this.pixelCount !== this.savedPixelCount)
    );
  }

  /**
   * 操作説明。sheet の外・上に text のみを薄く置く。
   * 記号 + マウス絵文字中心にして新規翻訳キーを増やさない
   * (プロジェクト方針: UI は i18n surface を増やさない設計を優先)。
   */
  private buildHintRow(): HTMLElement {
    const hint = document.createElement("div");
    hint.id = HINT_ID;
    // 右端は閉じるボタンの居場所なので空けておく (同じ段に並ぶため)
    hint.style.cssText = [
      "position:fixed;left:0;right:52px;z-index:1001",
      "pointer-events:none;text-align:center",
      "font-size:10px;line-height:1.2",
      "color:color-mix(in oklab, var(--color-base-content) 50%, transparent)",
    ].join(";");
    hint.textContent = this.buildHintText();
    return hint;
  }

  /** 🔒 ON 中は drag の意味が変わるので、その旨だけ差し替える */
  private buildHintText(): string {
    if (this.lineMode) return "●━━━━●   ◉↕   ↵✓   esc✕";
    return this.mapLocked
      ? "🔒 drag = draw / mid = spoit / right = erase"
      : "🖱️ dot / drag = move / Space+move = draw / mid = spoit / right = erase";
  }

  private updateToolbar(): void {
    const bar = document.getElementById(TOOLBAR_ID);
    if (!bar) return;

    if (!this.enabled) {
      bar.remove();
      document.getElementById(HINT_ID)?.remove();
      document.getElementById(CLOSE_ID)?.remove();
      document.getElementById(HISTORY_ID)?.remove();
      this.hideColorTip();
      this.closeBrushPopup();
      this.closeLinePopup();
      window.removeEventListener("resize", this.handleResize);
      return;
    }

    this.syncHistoryFab();

    // 選択中スワッチの強調
    const selectedId = localStorage.getItem(SELECTED_COLOR_KEY);
    for (const el of bar.querySelectorAll<HTMLElement>(".draft-swatch"))
      el.style.borderColor =
        !this.lineMode && !this.erasing && el.dataset.colorId === selectedId
          ? "var(--color-primary)"
          : "transparent";

    // NOTE: btn-square を落とすとアイコンボタンが潰れるので必ず維持する
    const eraser = document.getElementById(
      `${TOOLBAR_ID}-eraser`,
    ) as HTMLButtonElement | null;
    if (eraser)
      eraser.className = `btn btn-sm btn-square${this.erasing ? " btn-primary" : ""}`;

    const bucket = document.getElementById(
      `${TOOLBAR_ID}-bucket`,
    ) as HTMLButtonElement | null;
    if (bucket)
      bucket.className = `btn btn-sm btn-square${this.bucket ? " btn-primary" : ""}`;

    const line = document.getElementById(
      `${TOOLBAR_ID}-line`,
    ) as HTMLButtonElement | null;
    if (line)
      line.className = `btn btn-sm btn-square${this.lineMode ? " btn-primary" : ""}`;

    // ロックは状態が分かりにくいので、色だけでなく錠前の開閉も差し替える
    const lock = document.getElementById(
      `${TOOLBAR_ID}-lock`,
    ) as HTMLButtonElement | null;
    if (lock) {
      lock.className = `btn btn-sm btn-square${this.mapLocked ? " btn-primary" : ""}`;
      lock.innerHTML = this.mapLocked
        ? LOCK_CLOSED_ICON_SVG
        : LOCK_OPEN_ICON_SVG;
    }

    // ロックで drag の意味が変わるので操作説明も差し替える
    const hint = document.getElementById(HINT_ID);
    if (hint) hint.textContent = this.buildHintText();

    const save = document.getElementById(
      `${TOOLBAR_ID}-save`,
    ) as HTMLButtonElement | null;
    if (!save) return;

    // ベクタープレビューは ✓ でラスタ確定してから保存する。
    save.disabled = this.saving || this.pixelCount === 0 || this.lineMode;
    save.style.opacity = save.disabled ? "0.6" : "1";
    const label = this.savedKey ? t`${"draft_update"}` : t`${"draft_save"}`;
    save.textContent = `${label}${this.pixelCount > 0 ? ` (${this.pixelCount})` : ""}`;

    // ボタン文言で sheet の高さが変わりうるので毎回追従させる
    this.positionOverlays();
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
      // ここまでの内容は保存済み = 未保存変更なしの基準にする
      this.savedPixelCount = this.pixelCount;
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
