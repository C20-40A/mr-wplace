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
  sendDraftStampToInject,
  sendDraftLineToInject,
  sendDraftShapeToInject,
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
import { showFeatureHint } from "@/features/feature-hints";
import {
  ICON_SVG,
  ERASER_ICON_SVG,
  BRUSH_ICON_SVG,
  LINE_ICON_SVG,
  SHAPE_ICON_SVG,
  STAMP_ICON_SVG,
  BUCKET_ICON_SVG,
  CLEAR_PATTERN_ICON_SVG,
  STRAIGHT_ICON_SVG,
  X_ICON_SVG,
  CHECK_ICON_SVG,
  SQUARE_ICON_SVG,
  UNDO_ICON_SVG,
  REDO_ICON_SVG,
  LOCK_OPEN_ICON_SVG,
  LOCK_CLOSED_ICON_SVG,
  ICON_ATTRS,
} from "./svg";

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
const SHAPE_POPUP_ID = "mr-wplace-draft-shape-popup";
const STAMP_POPUP_ID = "mr-wplace-draft-stamp-popup";
/** undo/redo FAB (画面左上に浮かせる) */
const HISTORY_ID = "mr-wplace-draft-history";
/** マップロック (画面右上端に密着させる) */
const MAP_LOCK_ID = "mr-wplace-draft-map-lock";

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

type StampMode = "single" | "fill";
type StampPattern = {
  width: number;
  height: number;
  colorIds: Array<number | null>;
};
type StampSample = { width: number; height: number; cells: boolean[] };

const STAMP_MIN_SIZE = 1;
const STAMP_MAX_SIZE = 24;

const makeStampPattern = (
  width: number,
  height: number,
  isOn: (x: number, y: number) => boolean,
): StampSample => ({
  width,
  height,
  cells: Array.from({ length: width * height }, (_, index) =>
    isOn(index % width, Math.floor(index / width)),
  ),
});

/** UI samples: labels are replaced by the actual dot patterns. */
const STAMP_SAMPLES: readonly StampSample[] = [
  makeStampPattern(3, 3, (x, y) => x === 1 && y === 1),
  makeStampPattern(3, 3, (x, y) => y === 1 && (x === 1 || x === 2)),
  makeStampPattern(5, 5, (x, y) => x === 2 || y === 2),
  makeStampPattern(4, 4, (x, y) => ((x + y) & 1) === 0),
  makeStampPattern(
    7,
    6,
    (x, y) =>
      (y === 0 && (x === 1 || x === 2 || x === 4 || x === 5)) ||
      (y === 1 && x >= 0 && x <= 6) ||
      (y === 2 && x >= 0 && x <= 6) ||
      (y === 3 && x >= 1 && x <= 5) ||
      (y === 4 && x >= 2 && x <= 4) ||
      (y === 5 && x === 3),
  ),
];

const buildStampPreviewSvg = (pattern: StampSample, size = 28): string => {
  let cells = "";
  for (let y = 0; y < pattern.height; y++)
    for (let x = 0; x < pattern.width; x++)
      if (pattern.cells[y * pattern.width + x])
        cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pattern.width} ${pattern.height}" width="${size}" height="${size}" fill="currentColor" shape-rendering="crispEdges">${cells}</svg>`;
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

/** 下書き保存で作られたギャラリー item。再保存で上書きする */
const SAVED_KEY_PREFIX = "draft-";

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
  /** 直線トグル。ON の間は Shift 押下と同じ拘束が常時掛かる */
  private lineStraightMode = false;
  /** 確定前は角を動かせる矩形ツール */
  private shapeMode = false;
  private shapeStrokeWidth = 1;
  private shapeFilled = false;
  private shapeStrokeColorId = 10; // Yellow
  private shapeFillColorId = 9; // Gold
  private shapeColorTarget: "stroke" | "fill" = "stroke";
  /** 正方形トグル。ON の間は Shift 押下と同じ拘束が常時掛かる */
  private shapeSquareMode = false;
  /** 自作ドットパターン。single は1回配置、fill は連結領域へ反復する。 */
  private stampMode: StampMode | null = null;
  private stampWidth = STAMP_SAMPLES[1].width;
  private stampHeight = STAMP_SAMPLES[1].height;
  private stampColorId = 10;
  private stampColorIds = STAMP_SAMPLES[1].cells.map((cell) =>
    cell ? 10 : null,
  );
  private stampPaintColorId: number | null | undefined = null;

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

    // ✓/× や Enter の後もツールは ON のままにして続けて線を引けるようにする。
    // Escape だけは keepMode なしで届くのでツールごと閉じる。
    if (source === "mr-wplace-draft-line-ended") {
      if (!event.data.keepMode) {
        this.lineMode = false;
        this.closeLinePopup();
      }
      this.updateToolbar();
      return;
    }

    // 矩形も線と同じ扱い。Escape だけ keepMode なしで届くのでツールごと閉じる
    if (source === "mr-wplace-draft-shape-ended") {
      if (!event.data.keepMode) {
        this.shapeMode = false;
        this.closeShapePopup();
      }
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
    this.shapeMode = false;
    this.stampMode = null;
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
    this.shapeMode = false;
    this.stampMode = null;
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
    document.getElementById(MAP_LOCK_ID)?.remove();
    this.hideColorTip();
    this.closeBrushPopup();
    this.closeLinePopup();
    this.closeShapePopup();
    this.closeStampPopup();
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
    document.getElementById(MAP_LOCK_ID)?.remove();
    document.body.appendChild(this.buildMapLockButton());

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
        this.syncStampGrid();
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
      this.deactivateVectorTools();
      this.deactivateStampTool();
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
      this.deactivateStampTool();
      this.deactivateVectorTools();
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

    const shape = document.createElement("button");
    shape.id = `${TOOLBAR_ID}-shape`;
    shape.type = "button";
    shape.className = "btn btn-sm btn-square";
    shape.innerHTML = SHAPE_ICON_SVG;
    shape.title = "Rectangle";
    shape.setAttribute("aria-label", "Rectangle");
    shape.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.shapeMode) this.activateShapeTool();
      else this.toggleShapePopup();
    });

    const stamp = document.createElement("button");
    stamp.id = `${TOOLBAR_ID}-stamp`;
    stamp.type = "button";
    stamp.className = "btn btn-sm btn-square";
    stamp.innerHTML = STAMP_ICON_SVG;
    stamp.title = "Stamp";
    stamp.setAttribute("aria-label", "Stamp");
    stamp.addEventListener("click", (e) => {
      e.stopPropagation();
      this.deactivateVectorTools();
      this.closeBrushPopup();
      if (!this.stampMode) this.activateStampTool();
      else if (document.getElementById(STAMP_POPUP_ID)) this.closeStampPopup();
      else this.openStampPopup();
    });

    const bucket = document.createElement("button");
    bucket.id = `${TOOLBAR_ID}-bucket`;
    bucket.type = "button";
    bucket.className = "btn btn-sm btn-square";
    bucket.innerHTML = BUCKET_ICON_SVG;
    bucket.title = t`${"draft_bucket"}`;
    bucket.addEventListener("click", () => {
      this.deactivateVectorTools();
      this.deactivateStampTool();
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

    // 閉じるは sheet の外 (右上の丸バツ)、マップロックは画面右上端なので入れない
    row.append(save, brush, stamp, line, shape, eraser, bucket);
    return row;
  }

  /**
   * 確定前のベクター (線 / 矩形) を破棄してツールを閉じる。
   * 他ツールへ切り替える時の共通処理。
   */
  private deactivateVectorTools(): void {
    if (this.lineMode) this.finishLineTool("cancel");
    if (this.shapeMode) this.finishShapeTool("cancel");
    this.closeLinePopup();
    this.closeShapePopup();
  }

  // ------- popup shell (brush / line / stamp 共通) -------

  /**
   * ツールバーのボタンから生えるポップアップの共通ガワ。
   * 3 ツールで枠/位置/外側クリックの扱いが同じなのでここへ集約する。
   *
   * NOTE: 外側クリックの listener は **capture 段階**で張るので popup 自身より
   * 先に走る。つまり popup 側の stopPropagation では止められない。
   * 判定は伝播ではなく **target が popup / アンカーの内側か** で行うこと
   * (伝播に頼ると slider を押した瞬間に閉じて操作不能になる)。
   */
  private createPopupShell(
    popupId: string,
    extraStyle: string,
  ): HTMLElement | null {
    const popup = document.createElement("div");
    popup.id = popupId;
    popup.style.cssText = [
      "position:fixed;z-index:1004",
      "padding:10px;border-radius:12px",
      "background:var(--color-base-100)",
      "border:1px solid var(--color-base-300)",
      "color:var(--color-base-content)",
      "box-shadow:0 4px 16px rgb(0 0 0 / 0.25)",
      extraStyle,
    ].join(";");
    // 下のマップへ操作が抜けて誤爆で塗られるのを防ぐ
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());
    popup.addEventListener("click", (e) => e.stopPropagation());
    return popup;
  }

  /** アンカーボタンの真上・中央へ置く。画面端でははみ出さないよう clamp する */
  private positionPopupAbove(popup: HTMLElement, anchor: HTMLElement): void {
    const rect = anchor.getBoundingClientRect();
    popup.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    popup.style.left = `${Math.min(
      Math.max(rect.left + rect.width / 2 - popup.offsetWidth / 2, 8),
      window.innerWidth - popup.offsetWidth - 8,
    )}px`;
  }

  /**
   * 「popup の外か」判定。アンカーボタン自身は toggle 側へ任せるため除外する
   * (ここで閉じると閉じた直後に開き直してしまう)。
   */
  private isOutsidePopup(
    event: Event,
    popupId: string,
    anchorId: string,
  ): boolean {
    const target = event.target;
    if (!(target instanceof Node)) return true;
    if (document.getElementById(popupId)?.contains(target)) return false;
    return !document.getElementById(anchorId)?.contains(target);
  }

  // ------- stamp tool -------

  private getStampPattern(): StampPattern {
    return {
      width: this.stampWidth,
      height: this.stampHeight,
      colorIds: [...this.stampColorIds],
    };
  }

  private sendStampSettings(): void {
    if (!this.stampMode) return;
    sendDraftStampToInject({
      enabled: true,
      mode: this.stampMode,
      pattern: this.getStampPattern(),
    });
  }

  private activateStampTool(): void {
    this.erasing = false;
    this.bucket = false;
    this.stampMode = "single";
    sendDraftEraseModeToInject(false);
    sendDraftBucketModeToInject(false);
    this.sendStampSettings();
    this.updateToolbar();
    this.openStampPopup();
  }

  private deactivateStampTool(): void {
    if (!this.stampMode) return;
    this.stampMode = null;
    sendDraftStampToInject({ enabled: false });
    this.closeStampPopup();
    this.updateToolbar();
  }

  private openStampPopup(): void {
    this.closeStampPopup();
    const anchor = document.getElementById(`${TOOLBAR_ID}-stamp`);
    if (!anchor) return;

    const popup = this.createPopupShell(
      STAMP_POPUP_ID,
      "display:flex;flex-direction:column;align-items:stretch;gap:8px;width:min(360px,calc(100vw - 16px));max-height:min(520px,calc(100vh - 180px));overflow:auto",
    );
    if (!popup) return;

    const editor = document.createElement("div");
    editor.style.cssText =
      "display:flex;align-items:flex-start;justify-content:center;gap:10px;";

    const grid = document.createElement("div");
    grid.id = `${STAMP_POPUP_ID}-grid`;
    grid.style.cssText = [
      "display:grid;align-self:center;gap:1px",
      "padding:5px;border-radius:8px",
      "background:var(--color-base-300)",
      "touch-action:none;user-select:none",
    ].join(";");
    editor.append(grid, this.buildStampDimensionRow());
    popup.append(editor);
    popup.append(this.buildStampPalette());
    popup.append(this.buildStampSampleRow());

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;justify-content:center;gap:8px;";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn btn-sm btn-square";
    clear.innerHTML = CLEAR_PATTERN_ICON_SVG;
    clear.title = "Clear pattern";
    clear.setAttribute("aria-label", "Clear pattern");
    clear.addEventListener("click", () => {
      this.stampColorIds.fill(null);
      this.syncStampGrid();
      this.sendStampSettings();
    });
    actions.append(clear);
    popup.append(actions);
    popup.append(this.buildStampModeRow());

    document.body.appendChild(popup);
    this.syncStampPopup();
    this.positionPopupAbove(popup, anchor);

    window.addEventListener("pointerdown", this.handleOutsideStampClick, {
      capture: true,
    });
    window.addEventListener("pointerup", this.handleStampPaintEnd, {
      capture: true,
    });
    window.addEventListener("pointercancel", this.handleStampPaintEnd, {
      capture: true,
    });
  }

  private buildStampModeRow(): HTMLElement {
    const row = document.createElement("div");
    row.id = `${STAMP_POPUP_ID}-modes`;
    row.style.cssText = "display:flex;justify-content:center;gap:8px;";
    const options: Array<{ mode: StampMode; icon: string }> = [
      { mode: "single", icon: STAMP_ICON_SVG },
      { mode: "fill", icon: BUCKET_ICON_SVG },
    ];
    for (const { mode, icon } of options) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.stampMode = mode;
      button.className = "btn btn-sm";
      button.style.cssText =
        "display:flex;align-items:center;gap:5px;padding-inline:10px;";
      button.innerHTML = `${icon}<span>${mode === "single" ? "Stamp" : "Fill"}</span>`;
      button.title = mode === "single" ? "Stamp" : "Fill";
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => {
        this.stampMode = mode;
        this.sendStampSettings();
        this.syncStampPopup();
        this.updateToolbar();
      });
      row.append(button);
    }
    return row;
  }

  private buildStampSampleRow(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;justify-content:center;gap:6px;";
    STAMP_SAMPLES.forEach((sample, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-sm btn-square";
      button.style.padding = "3px";
      button.innerHTML = buildStampPreviewSvg(sample, 24);
      button.title = `Sample ${index + 1}`;
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => {
        this.stampWidth = sample.width;
        this.stampHeight = sample.height;
        this.stampColorIds = sample.cells.map((cell) =>
          cell ? this.stampColorId : null,
        );
        this.syncStampPopup();
        this.sendStampSettings();
      });
      row.append(button);
    });
    return row;
  }

  private buildStampDimensionRow(): HTMLElement {
    const row = document.createElement("div");
    row.id = `${STAMP_POPUP_ID}-dimensions`;
    row.style.cssText =
      "display:flex;flex-direction:column;justify-content:center;gap:6px;";

    const build = (axis: "width" | "height"): HTMLElement => {
      const group = document.createElement("div");
      group.style.cssText = "display:flex;align-items:center;gap:4px;";
      const axisIcon = document.createElement("span");
      axisIcon.style.cssText = "display:flex;opacity:.65";
      axisIcon.innerHTML =
        axis === "width"
          ? `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M12 4v16M9 7l3-3 3 3M9 17l3 3 3-3"/></svg>`;
      group.append(axisIcon);

      const addStep = (delta: number, icon: string): void => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-xs btn-square";
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}>${icon}</svg>`;
        button.addEventListener("click", () => {
          const width =
            axis === "width" ? this.stampWidth + delta : this.stampWidth;
          const height =
            axis === "height" ? this.stampHeight + delta : this.stampHeight;
          this.resizeStampPattern(width, height);
        });
        group.append(button);
      };
      addStep(-1, `<path d="M5 12h14"/>`);

      const output = document.createElement("output");
      output.dataset.stampDimension = axis;
      output.style.cssText =
        "min-width:24px;text-align:center;font:12px/1 monospace;";
      group.append(output);
      addStep(1, `<path d="M12 5v14M5 12h14"/>`);
      return group;
    };

    row.append(build("width"), build("height"));
    return row;
  }

  private resizeStampPattern(width: number, height: number): void {
    const nextWidth = Math.max(
      STAMP_MIN_SIZE,
      Math.min(STAMP_MAX_SIZE, Math.round(width)),
    );
    const nextHeight = Math.max(
      STAMP_MIN_SIZE,
      Math.min(STAMP_MAX_SIZE, Math.round(height)),
    );
    if (nextWidth === this.stampWidth && nextHeight === this.stampHeight)
      return;

    const colorIds = Array(nextWidth * nextHeight).fill(null) as Array<
      number | null
    >;
    const offsetX = Math.floor((nextWidth - this.stampWidth) / 2);
    const offsetY = Math.floor((nextHeight - this.stampHeight) / 2);
    for (let y = 0; y < this.stampHeight; y++)
      for (let x = 0; x < this.stampWidth; x++) {
        const nx = x + offsetX;
        const ny = y + offsetY;
        if (nx >= 0 && nx < nextWidth && ny >= 0 && ny < nextHeight)
          colorIds[ny * nextWidth + nx] =
            this.stampColorIds[y * this.stampWidth + x];
      }

    this.stampWidth = nextWidth;
    this.stampHeight = nextHeight;
    this.stampColorIds = colorIds;
    this.syncStampPopup();
    this.sendStampSettings();
  }

  private getStampColorCss(colorId: number | null): string {
    const color = colorpalette.find((entry) => entry.id === colorId);
    return color ? `rgb(${color.rgb.join(",")})` : "var(--color-base-200)";
  }

  private buildStampPalette(): HTMLElement {
    const palette = document.createElement("div");
    palette.id = `${STAMP_POPUP_ID}-palette`;
    palette.style.cssText =
      "display:grid;grid-template-columns:repeat(9,1fr);gap:3px;margin:0 auto;width:min(250px,100%);";
    for (const color of colorpalette) {
      if (color.id === TRANSPARENT_COLOR_ID) continue;
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.dataset.stampColorId = String(color.id);
      swatch.className = "btn btn-xs btn-square";
      swatch.style.cssText = `height:16px;min-height:16px;padding:0;background:rgb(${color.rgb.join(",")});border:2px solid transparent;`;
      swatch.title = color.name;
      swatch.setAttribute("aria-label", color.name);
      swatch.addEventListener("click", () => {
        this.stampColorId = color.id;
        this.syncStampPalette();
      });
      palette.append(swatch);
    }
    return palette;
  }

  private syncStampPalette(): void {
    for (const swatch of document.querySelectorAll<HTMLElement>(
      `[data-stamp-color-id]`,
    ))
      swatch.style.borderColor =
        Number(swatch.dataset.stampColorId) === this.stampColorId
          ? "var(--color-primary)"
          : "transparent";
  }

  private syncStampPopup(): void {
    for (const button of document.querySelectorAll<HTMLElement>(
      `[data-stamp-mode]`,
    ))
      button.className = `btn btn-sm${button.dataset.stampMode === this.stampMode ? " btn-primary" : ""}`;

    for (const output of document.querySelectorAll<HTMLOutputElement>(
      `[data-stamp-dimension]`,
    ))
      output.value = String(
        output.dataset.stampDimension === "width"
          ? this.stampWidth
          : this.stampHeight,
      );

    this.syncStampPalette();
    this.syncStampGrid();
  }

  private syncStampGrid(): void {
    const grid = document.getElementById(`${STAMP_POPUP_ID}-grid`);
    if (!grid) return;
    const size = Math.max(
      8,
      Math.min(
        20,
        Math.floor(220 / Math.max(this.stampWidth, this.stampHeight)),
      ),
    );
    grid.style.gridTemplateColumns = `repeat(${this.stampWidth},${size}px)`;
    grid.replaceChildren();

    this.stampColorIds.forEach((colorId, index) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.dataset.stampCell = String(index);
      cell.setAttribute("aria-label", `Pixel ${index + 1}`);
      cell.style.cssText = [
        `width:${size}px;height:${size}px;padding:0;border:0;border-radius:1px`,
        `background:${this.getStampColorCss(colorId)}`,
        "cursor:crosshair;touch-action:none",
      ].join(";");
      cell.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        this.stampPaintColorId =
          this.stampColorIds[index] === this.stampColorId
            ? null
            : this.stampColorId;
        this.setStampCell(index, this.stampPaintColorId);
      });
      cell.addEventListener("pointerenter", (event) => {
        if (event.buttons === 0 || this.stampPaintColorId === undefined) return;
        this.setStampCell(index, this.stampPaintColorId);
      });
      grid.append(cell);
    });
  }

  private setStampCell(index: number, colorId: number | null): void {
    if (this.stampColorIds[index] === colorId) return;
    this.stampColorIds[index] = colorId;
    const cell = document.querySelector<HTMLElement>(
      `[data-stamp-cell="${index}"]`,
    );
    if (cell) cell.style.background = this.getStampColorCss(colorId);
    this.sendStampSettings();
  }

  private handleStampPaintEnd = (): void => {
    this.stampPaintColorId = undefined;
  };

  private handleOutsideStampClick = (event: Event): void => {
    if (this.isOutsidePopup(event, STAMP_POPUP_ID, `${TOOLBAR_ID}-stamp`))
      this.closeStampPopup();
  };

  private closeStampPopup(): void {
    document.getElementById(STAMP_POPUP_ID)?.remove();
    this.stampPaintColorId = undefined;
    window.removeEventListener("pointerdown", this.handleOutsideStampClick, {
      capture: true,
    });
    window.removeEventListener("pointerup", this.handleStampPaintEnd, {
      capture: true,
    });
    window.removeEventListener("pointercancel", this.handleStampPaintEnd, {
      capture: true,
    });
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
    this.deactivateStampTool();
    if (this.shapeMode) this.finishShapeTool("cancel");
    this.closeShapePopup();
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
      straightMode: this.lineStraightMode,
    });
    this.updateToolbar();
    this.openLinePopup();
  }

  /**
   * 編集中の線を確定/破棄する。
   * `keepMode` の時はツールを ON のまま残し、続けて次の線を引けるようにする
   * (他ツールへ切り替える時だけ完全に閉じる)。
   */
  private finishLineTool(command: "commit" | "cancel", keepMode = false): void {
    if (!this.lineMode) return;
    sendDraftLineToInject({ command, keepMode });
    if (keepMode) {
      this.updateToolbar();
      return;
    }
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

    const popup = this.createPopupShell(
      LINE_POPUP_ID,
      "display:flex;flex-direction:column;gap:8px;width:min(340px,calc(100vw - 16px));max-height:min(440px,calc(100vh - 180px));overflow:auto",
    );
    if (!popup) return;

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
    actions.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:8px;";

    // 直線トグル。Shift 押しっぱなしの代わりになる
    const straight = document.createElement("button");
    straight.id = `${LINE_POPUP_ID}-straight`;
    straight.type = "button";
    straight.className = "btn btn-sm btn-square";
    straight.innerHTML = STRAIGHT_ICON_SVG;
    straight.title = "Straight line (Shift)";
    straight.setAttribute("aria-label", straight.title);
    straight.addEventListener("click", () => {
      this.lineStraightMode = !this.lineStraightMode;
      sendDraftLineToInject({ straightMode: this.lineStraightMode });
      this.syncLinePopup();
    });
    actions.append(straight);

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-sm btn-square";
    cancel.innerHTML = X_ICON_SVG;
    cancel.title = "Cancel";
    cancel.addEventListener("click", () => this.finishLineTool("cancel", true));
    const commit = document.createElement("button");
    commit.type = "button";
    commit.className = "btn btn-sm btn-square btn-primary";
    commit.innerHTML = CHECK_ICON_SVG;
    commit.title = "Apply";
    commit.addEventListener("click", () => this.finishLineTool("commit", true));
    buttons.append(cancel, commit);
    actions.append(buttons);
    popup.append(actions);

    document.body.appendChild(popup);
    this.positionPopupAbove(popup, anchor);
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

    // NOTE: btn-square を落とすとアイコンが潰れるので必ず維持する
    const straight = document.getElementById(`${LINE_POPUP_ID}-straight`);
    if (straight)
      straight.className = `btn btn-sm btn-square${this.lineStraightMode ? " btn-primary" : ""}`;

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
    if (this.isOutsidePopup(event, LINE_POPUP_ID, `${TOOLBAR_ID}-line`))
      this.closeLinePopup();
  };

  private closeLinePopup(): void {
    document.getElementById(LINE_POPUP_ID)?.remove();
    window.removeEventListener("pointerdown", this.handleOutsideLineClick, {
      capture: true,
    });
  }

  // ------- shape (rectangle) tool -------

  /** 枠の太さ・塗りの有無・両方の色が一目で分かる矩形サンプル */
  private buildShapePreviewSvg(): string {
    const stroke = this.getLineColor(this.shapeStrokeColorId);
    const fill = this.getLineColor(this.shapeFillColorId);
    // 実寸ではなくサンプル上の見た目の太さ (0 は枠なし)
    const strokeWidth = Math.min(10, this.shapeStrokeWidth * 1.5);
    const inset = strokeWidth / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 34" width="120" height="34" style="display:block"><rect x="${24 + inset}" y="${4 + inset}" width="${72 - strokeWidth}" height="${26 - strokeWidth}" fill="${
      this.shapeFilled ? `rgb(${fill.rgb.join(",")})` : "none"
    }" stroke="${
      this.shapeStrokeWidth > 0 ? `rgb(${stroke.rgb.join(",")})` : "none"
    }" stroke-width="${strokeWidth}"/></svg>`;
  }

  private activateShapeTool(): void {
    this.closeBrushPopup();
    this.deactivateStampTool();
    if (this.lineMode) this.finishLineTool("cancel");
    this.closeLinePopup();
    this.erasing = false;
    this.bucket = false;
    this.shapeMode = true;
    sendDraftEraseModeToInject(false);
    sendDraftBucketModeToInject(false);
    sendDraftShapeToInject({
      enabled: true,
      strokeWidth: this.shapeStrokeWidth,
      filled: this.shapeFilled,
      strokeColorId: this.shapeStrokeColorId,
      fillColorId: this.shapeFillColorId,
      squareMode: this.shapeSquareMode,
    });
    this.updateToolbar();
    this.openShapePopup();
  }

  /**
   * 編集中の矩形を確定/破棄する。
   * `keepMode` の時はツールを ON のまま残し、続けて次の矩形を描けるようにする。
   */
  private finishShapeTool(
    command: "commit" | "cancel",
    keepMode = false,
  ): void {
    if (!this.shapeMode) return;
    sendDraftShapeToInject({ command, keepMode });
    if (keepMode) {
      this.updateToolbar();
      return;
    }
    this.shapeMode = false;
    this.closeShapePopup();
    this.updateToolbar();
  }

  private toggleShapePopup(): void {
    if (document.getElementById(SHAPE_POPUP_ID)) this.closeShapePopup();
    else this.openShapePopup();
  }

  private openShapePopup(): void {
    this.closeShapePopup();
    const anchor = document.getElementById(`${TOOLBAR_ID}-shape`);
    if (!anchor) return;

    const popup = this.createPopupShell(
      SHAPE_POPUP_ID,
      "display:flex;flex-direction:column;gap:8px;width:min(340px,calc(100vw - 16px));max-height:min(440px,calc(100vh - 180px));overflow:auto",
    );
    if (!popup) return;

    const preview = document.createElement("div");
    preview.id = `${SHAPE_POPUP_ID}-preview`;
    preview.style.cssText =
      "display:flex;align-items:center;justify-content:center;height:40px;border-radius:8px;background:var(--color-base-200);";
    preview.innerHTML = this.buildShapePreviewSvg();
    popup.append(preview);
    popup.append(this.buildShapeStrokeControl());
    popup.append(this.buildShapeColorChannels());
    popup.append(this.buildShapePalette());

    const actions = document.createElement("div");
    actions.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:8px;";

    const toggles = document.createElement("div");
    toggles.style.cssText = "display:flex;gap:8px;";

    // 正方形トグル。Shift 押しっぱなしの代わりになる
    const square = document.createElement("button");
    square.id = `${SHAPE_POPUP_ID}-square`;
    square.type = "button";
    square.className = "btn btn-sm btn-square";
    square.innerHTML = SQUARE_ICON_SVG;
    square.title = "Square (Shift)";
    square.setAttribute("aria-label", square.title);
    square.addEventListener("click", () => {
      this.shapeSquareMode = !this.shapeSquareMode;
      sendDraftShapeToInject({ squareMode: this.shapeSquareMode });
      this.syncShapePopup();
    });

    // 塗りつぶしトグル。OFF なら枠だけ残る
    const filled = document.createElement("button");
    filled.id = `${SHAPE_POPUP_ID}-filled`;
    filled.type = "button";
    filled.className = "btn btn-sm btn-square";
    filled.title = "Fill";
    filled.setAttribute("aria-label", filled.title);
    filled.addEventListener("click", () => {
      this.shapeFilled = !this.shapeFilled;
      sendDraftShapeToInject({ filled: this.shapeFilled });
      this.syncShapePopup();
    });
    toggles.append(square, filled);
    actions.append(toggles);

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn btn-sm btn-square";
    cancel.innerHTML = X_ICON_SVG;
    cancel.title = "Cancel";
    cancel.addEventListener("click", () =>
      this.finishShapeTool("cancel", true),
    );
    const commit = document.createElement("button");
    commit.type = "button";
    commit.className = "btn btn-sm btn-square btn-primary";
    commit.innerHTML = CHECK_ICON_SVG;
    commit.title = "Apply";
    commit.addEventListener("click", () =>
      this.finishShapeTool("commit", true),
    );
    buttons.append(cancel, commit);
    actions.append(buttons);
    popup.append(actions);

    document.body.appendChild(popup);
    this.positionPopupAbove(popup, anchor);
    window.addEventListener("pointerdown", this.handleOutsideShapeClick, {
      capture: true,
    });
    this.syncShapePopup();
  }

  /** 枠の太さ。0 にすると枠が消えて塗りだけになる */
  private buildShapeStrokeControl(): HTMLElement {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;";
    const icon = document.createElement("span");
    icon.style.cssText = "display:flex;width:28px;justify-content:center;";
    icon.innerHTML = `<svg ${ICON_ATTRS}><rect width="18" height="18" x="3" y="3" rx="2" stroke-width="4"/></svg>`;

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "32";
    slider.value = String(this.shapeStrokeWidth);
    slider.className = "range range-xs";
    slider.style.cssText = "flex:1;min-width:0;";
    slider.addEventListener("input", () => {
      this.shapeStrokeWidth = Number(slider.value);
      sendDraftShapeToInject({ strokeWidth: this.shapeStrokeWidth });
      this.syncShapePopup();
    });
    row.append(icon, slider);
    return row;
  }

  private buildShapeColorChannels(): HTMLElement {
    const row = document.createElement("div");
    row.id = `${SHAPE_POPUP_ID}-channels`;
    row.style.cssText = "display:flex;justify-content:center;gap:10px;";
    for (const kind of ["stroke", "fill"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.shapeColorTarget = kind;
      button.className = "btn btn-sm btn-square";
      button.addEventListener("click", () => {
        this.shapeColorTarget = kind;
        this.syncShapePopup();
      });
      row.append(button);
    }
    return row;
  }

  private buildShapePalette(): HTMLElement {
    const palette = document.createElement("div");
    palette.style.cssText =
      "display:grid;grid-template-columns:repeat(9,1fr);gap:4px;";
    for (const color of colorpalette) {
      if (color.id === TRANSPARENT_COLOR_ID) continue;
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.dataset.shapeColorId = String(color.id);
      swatch.style.cssText = `aspect-ratio:1;min-width:0;border-radius:3px;background:rgb(${color.rgb.join(",")});border:2px solid transparent;padding:0;cursor:pointer;`;
      swatch.title = color.name;
      swatch.addEventListener("click", () => {
        if (this.shapeColorTarget === "stroke")
          this.shapeStrokeColorId = color.id;
        else this.shapeFillColorId = color.id;
        sendDraftShapeToInject(
          this.shapeColorTarget === "stroke"
            ? { strokeColorId: color.id }
            : { fillColorId: color.id },
        );
        this.syncShapePopup();
      });
      palette.append(swatch);
    }
    return palette;
  }

  private syncShapePopup(): void {
    const preview = document.getElementById(`${SHAPE_POPUP_ID}-preview`);
    if (preview) preview.innerHTML = this.buildShapePreviewSvg();

    // NOTE: btn-square を落とすとアイコンが潰れるので必ず維持する
    const square = document.getElementById(`${SHAPE_POPUP_ID}-square`);
    if (square)
      square.className = `btn btn-sm btn-square${this.shapeSquareMode ? " btn-primary" : ""}`;

    const filled = document.getElementById(`${SHAPE_POPUP_ID}-filled`);
    if (filled) {
      filled.className = `btn btn-sm btn-square${this.shapeFilled ? " btn-primary" : ""}`;
      // 塗りの ON/OFF を中身の塗り潰しでそのまま示す
      const fill = this.getLineColor(this.shapeFillColorId);
      filled.innerHTML = `<svg ${ICON_ATTRS}><rect width="18" height="18" x="3" y="3" rx="2" fill="${
        this.shapeFilled ? `rgb(${fill.rgb.join(",")})` : "none"
      }"/></svg>`;
    }

    for (const button of document.querySelectorAll<HTMLElement>(
      `[data-shape-color-target]`,
    )) {
      const kind = button.dataset.shapeColorTarget as "stroke" | "fill";
      const color = this.getLineColor(
        kind === "stroke" ? this.shapeStrokeColorId : this.shapeFillColorId,
      );
      button.className = `btn btn-sm btn-square${kind === this.shapeColorTarget ? " btn-primary" : ""}`;
      button.title = color.name;
      button.innerHTML =
        kind === "fill"
          ? `<span style="width:20px;height:20px;border-radius:4px;background:rgb(${color.rgb.join(",")});border:1px solid rgb(0 0 0 / .35)"></span>`
          : `<span style="width:20px;height:20px;border-radius:4px;background:rgb(${color.rgb.join(",")});padding:5px"><span style="display:block;width:100%;height:100%;border-radius:1px;background:var(--color-base-100)"></span></span>`;
    }

    const selectedId =
      this.shapeColorTarget === "stroke"
        ? this.shapeStrokeColorId
        : this.shapeFillColorId;
    for (const swatch of document.querySelectorAll<HTMLElement>(
      `[data-shape-color-id]`,
    ))
      swatch.style.borderColor =
        Number(swatch.dataset.shapeColorId) === selectedId
          ? "var(--color-primary)"
          : "transparent";
  }

  private handleOutsideShapeClick = (event: Event): void => {
    if (this.isOutsidePopup(event, SHAPE_POPUP_ID, `${TOOLBAR_ID}-shape`))
      this.closeShapePopup();
  };

  private closeShapePopup(): void {
    document.getElementById(SHAPE_POPUP_ID)?.remove();
    window.removeEventListener("pointerdown", this.handleOutsideShapeClick, {
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

    const popup = this.createPopupShell(
      BRUSH_POPUP_ID,
      "display:flex;flex-direction:column;gap:8px;min-width:200px",
    );
    if (!popup) return;

    popup.appendChild(this.buildBrushSizeRow());
    popup.appendChild(this.buildDitherStyleRow());

    document.body.appendChild(popup);
    this.positionPopupAbove(popup, anchor);

    // 外側をクリックしたら閉じる (capture で map より先に拾う)
    window.addEventListener("pointerdown", this.handleOutsideBrushClick, {
      capture: true,
    });
  }

  private handleOutsideBrushClick = (event: Event): void => {
    if (this.isOutsidePopup(event, BRUSH_POPUP_ID, `${TOOLBAR_ID}-brush`))
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

  /**
   * マップロック。**画面の右上端に隙間なく密着**させた四角ボタン
   * (undo/redo は左上のままなので左右で役割が分かれる)。
   * ON にすると左ドラッグが pan ではなく描画になる。
   */
  private buildMapLockButton(): HTMLElement {
    const lock = document.createElement("button");
    lock.id = MAP_LOCK_ID;
    lock.type = "button";
    lock.className = "btn btn-sm btn-square shadow-md";
    // 画面端に接するので角丸を殺す (丸型だと端の隙間が目立つため)
    lock.style.cssText =
      "position:fixed;top:0;right:0;z-index:1002;border-radius:0;";
    lock.innerHTML = LOCK_OPEN_ICON_SVG;
    lock.title = t`${"draft_map_lock"}`;
    lock.addEventListener("click", () => {
      this.mapLocked = !this.mapLocked;
      sendDraftMapLockToInject(this.mapLocked);
      this.updateToolbar();
    });
    return lock;
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
      this.lineMode ||
      (this.pixelCount > 0 && this.pixelCount !== this.savedPixelCount)
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
    if (this.stampMode === "single") return "▦  →  ⬚";
    if (this.stampMode === "fill") return "▦  ↻  ▦▦▦";
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
      document.getElementById(MAP_LOCK_ID)?.remove();
      this.hideColorTip();
      this.closeBrushPopup();
      this.closeLinePopup();
      this.closeShapePopup();
      this.closeStampPopup();
      window.removeEventListener("resize", this.handleResize);
      return;
    }

    this.syncHistoryFab();

    // 選択中スワッチの強調
    const selectedId = localStorage.getItem(SELECTED_COLOR_KEY);
    for (const el of bar.querySelectorAll<HTMLElement>(".draft-swatch"))
      el.style.borderColor =
        !this.lineMode &&
        !this.shapeMode &&
        !this.erasing &&
        el.dataset.colorId === selectedId
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

    const shape = document.getElementById(
      `${TOOLBAR_ID}-shape`,
    ) as HTMLButtonElement | null;
    if (shape)
      shape.className = `btn btn-sm btn-square${this.shapeMode ? " btn-primary" : ""}`;

    const stamp = document.getElementById(
      `${TOOLBAR_ID}-stamp`,
    ) as HTMLButtonElement | null;
    if (stamp)
      stamp.className = `btn btn-sm btn-square${this.stampMode ? " btn-primary" : ""}`;

    // ロックは状態が分かりにくいので、色だけでなく錠前の開閉も差し替える。
    // NOTE: 画面右上端の独立ボタンなので shadow-md も落とさないこと
    const lock = document.getElementById(
      MAP_LOCK_ID,
    ) as HTMLButtonElement | null;
    if (lock) {
      lock.className = `btn btn-square shadow-md${this.mapLocked ? " btn-primary" : ""}`;
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
    save.disabled =
      this.saving || this.pixelCount === 0 || this.lineMode || this.shapeMode;
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
