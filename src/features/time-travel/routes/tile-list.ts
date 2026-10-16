import { TimeTravelRouter } from "../router";
import {
  TimeTravelStorage,
  TileSnapshotInfo,
  SnapshotDrawState,
} from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "@/i18n/manager";
import { createCard, CardConfig } from "@/components/card";
import { storage, runtime } from "@/utils/browser-api";
import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { latLonToPixels, TILE_SIZE } from "@/utils/geo-converter";
import { WORLD_LAND_RINGS } from "../map/world-land";
import { getThumbnailDataUrl } from "@/utils/inject-bridge";
import { Tutorial } from "@/features/tutorial";
import { runSnapshotExport } from "../utils/export-snapshots";
import { VIEWPORT_MEDIA_QUERIES } from "@/constants/breakpoints";
import {
  ENABLE_SNAPSHOT_THUMBNAILS,
  attachSnapshotThumbnails,
  type SnapshotThumbnailHandle,
} from "../thumbnail";

type TileSortType = "distance" | "last_updated" | "tile_count" | "name";
type TileViewMode = "grid" | "map";
const TILE_SORT_KEY = "wplace-studio-tile-sort";
const TILE_VIEW_MODE_KEY = "wplace-studio-tile-view-mode";

/** map モード: 1タイルあたりのワールド座標サイズ(px) */
const MAP_CELL = 64;
/** map モード: タイル間の隙間(ワールド座標) */
const MAP_GAP = 4;
/** map モード: ズーム下限/上限（下限は「全体フィット」を許すため小さめ） */
const MAP_MIN_SCALE = 0.002;
const MAP_MAX_SCALE = 8;
/** 画面上のセルがこれ以上になったら、その範囲だけサムネを遅延取得する */
const MAP_DETAIL_CELL_PX = 44;

/** map モード: 世界全体のタイル数（ZOOM_LEVEL=11 なので 2^11）。座標の折り返し判定に使う */
const MAP_WORLD_TILES = 1 << 11;

/**
 * map モード: クラスタ化の粗さ（画面上の目標間隔 px）。
 * 縮小時は近接タイルをこの間隔でまとめ、大きめのマーカーにして押しやすくする。
 */
const MAP_CLUSTER_PX = 34;
/** クラスタの半径（画面 px）。数が多いほど大きく、上限あり */
const MAP_CLUSTER_MIN_R = 5;
const MAP_CLUSTER_MAX_R = 17;

/** map モードのタイル1つ分（描画・クリック判定用） */
interface MapPoint {
  x: number;
  y: number;
  count: number;
  active: boolean;
  tileX: number;
  tileY: number;
  name: string;
  /** 最新スナップショットのサムネイルID（無ければ undefined） */
  thumbnailId?: string;
}

/** 縮小時にまとめて表示するクラスタ（描画・クリック判定用） */
interface MapCluster {
  /** 重心（ワールド座標） */
  x: number;
  y: number;
  /** まとめたタイル数 */
  n: number;
  /** まとめたスナップショット合計 */
  count: number;
  /** 1つでも描画中スナップショットを持つか */
  active: boolean;
  /** 代表タイル（ポップアップ表示に使う） */
  lead: MapPoint;
  /** メンバーの範囲（ワールド座標）。拡大フィットに使う */
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** HTML文字列に埋め込むユーザー入力のエスケープ（属性・テキスト両用） */
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char] as string,
  );

/**
 * タイル一覧ルート。
 *
 * - grid: コンパクトなカード。サムネはカード全体にうっすら背景として敷く。
 * - map : 実座標を正規化し、全体を1画面にフィットさせた簡易マップ（ズーム/パン可）。
 *
 * スクロールはモーダル標準のスクローラに任せる（カード外の余白でも普通に
 * スクロールできるように、独自のホイール/タッチ横取りはしない）。
 */
export class TileListRoute {
  private currentSortType: TileSortType = "distance";
  private currentViewMode: TileViewMode = "grid";
  private tutorial: Tutorial;
  private thumbnailHandle: SnapshotThumbnailHandle | null = null;

  // --- map モードの状態 ---
  private router: TimeTravelRouter | null = null;
  private mapViewport: HTMLElement | null = null;
  private mapWorld: HTMLElement | null = null;
  private mapCanvas: HTMLCanvasElement | null = null;
  private mapPopover: HTMLElement | null = null;
  private mapPoints: MapPoint[] = [];
  /** 縮小時のクラスタ（scale が変わった時だけ再計算） */
  private mapClusters: MapCluster[] = [];
  private mapClusterScale = -1;
  /** 大陸シルエット（map のローカル座標に変換済み。[x,y,x,y,...] のリング配列） */
  private mapLand: number[][] = [];
  private mapScale = 1;
  private mapTx = 0;
  private mapTy = 0;
  private mapWorldW = 1;
  private mapWorldH = 1;
  private mapDetail = false;
  private mapDragged = false;
  private mapPointerMove: ((e: PointerEvent) => void) | null = null;
  private mapPointerUp: ((e: PointerEvent) => void) | null = null;
  private mapResize: (() => void) | null = null;

  constructor() {
    this.tutorial = new Tutorial();
  }

  async render(
    container: HTMLElement,
    router: TimeTravelRouter,
  ): Promise<void> {
    this.cleanup();
    this.router = router;

    // Load saved sort type / view mode
    const result = await storage.get([TILE_SORT_KEY, TILE_VIEW_MODE_KEY]);
    this.currentSortType = result[TILE_SORT_KEY] || "tile_count";
    this.currentViewMode =
      (result[TILE_VIEW_MODE_KEY] as TileViewMode) === "map" ? "map" : "grid";

    container.innerHTML = t`
      <div id="wps-tile-page" style="padding: 0.5rem;">
        <div class="mb-2" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button id="wps-import-export-btn" class="btn btn-outline btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M440-367v-465l-64 64-56-57 160-160 160 160-56 57-64-64v465h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
            </svg>
            <span id="wps-import-export-label">${"import_export"}</span>
          </button>
          <button id="wps-tile-merge-btn" class="btn btn-sm btn-primary">
            ${"merge_tiles"}
          </button>
          <select id="wps-tile-sort" class="select select-sm select-bordered ml-auto">
            <option value="distance">${t`${"sort_distance"}`}</option>
            <option value="last_updated">${t`${"sort_last_updated"}`}</option>
            <option value="tile_count">${t`${"sort_tile_count"}`}</option>
            <option value="name">${t`${"sort_name"}`}</option>
          </select>
          <select id="wps-tile-view" class="select select-sm select-bordered" title="${t`${"view_mode"}`}">
            <option value="grid">${t`${"view_grid"}`}</option>
            <option value="map">${t`${"view_map"}`}</option>
          </select>
        </div>
        <div id="wps-tile-list">
          <div class="text-sm text-base-content/60 text-center p-4">${"loading"}</div>
        </div>
      </div>
    `;

    // Set sort / view dropdown values
    const sortSelect = container.querySelector(
      "#wps-tile-sort",
    ) as HTMLSelectElement;
    if (sortSelect) sortSelect.value = this.currentSortType;

    const viewSelect = container.querySelector(
      "#wps-tile-view",
    ) as HTMLSelectElement;
    if (viewSelect) viewSelect.value = this.currentViewMode;

    this.setupEvents(container, router);
    this.loadTileList(container);
    this.tutorial.createButton(container);
  }

  /** 遅延ローダーの後始末（Observer を解放） */
  private detachThumbnails(): void {
    this.thumbnailHandle?.disconnect();
    this.thumbnailHandle = null;
  }

  /** map のイベント/状態を破棄 */
  private teardownMap(): void {
    if (this.mapPointerMove) {
      window.removeEventListener("pointermove", this.mapPointerMove);
      this.mapPointerMove = null;
    }
    if (this.mapPointerUp) {
      window.removeEventListener("pointerup", this.mapPointerUp);
      window.removeEventListener("pointercancel", this.mapPointerUp);
      this.mapPointerUp = null;
    }
    if (this.mapResize) {
      window.removeEventListener("resize", this.mapResize);
      this.mapResize = null;
    }
    this.hideMapPopover();
    this.mapViewport = null;
    this.mapWorld = null;
    this.mapCanvas = null;
    this.mapPoints = [];
    this.mapClusters = [];
    this.mapClusterScale = -1;
    this.mapLand = [];
    this.mapDetail = false;
  }

  private cleanup(): void {
    this.detachThumbnails();
    this.teardownMap();
  }

  /** モーダルクローズ時などに呼ぶ（リーク防止） */
  destroy(): void {
    this.cleanup();
  }

  private setupEvents(container: HTMLElement, router: TimeTravelRouter): void {
    // Import/Export dropdown menu
    const importExportBtn = container.querySelector(
      "#wps-import-export-btn",
    ) as HTMLButtonElement | null;
    importExportBtn?.addEventListener("click", () => {
      this.showImportExportMenu(importExportBtn, router);
    });

    // モバイル時はテキスト非表示
    const importExportLabel = container.querySelector(
      "#wps-import-export-label",
    ) as HTMLElement | null;
    if (importExportLabel) {
      const mq = window.matchMedia(VIEWPORT_MEDIA_QUERIES.smUp);
      const update = () => {
        importExportLabel.style.display = mq.matches ? "" : "none";
      };
      update();
      mq.addEventListener("change", update);
    }

    // Merge button event
    container
      .querySelector("#wps-tile-merge-btn")
      ?.addEventListener("click", () => {
        router.navigate("tile-merge");
      });

    // Sort dropdown event
    container
      .querySelector("#wps-tile-sort")
      ?.addEventListener("change", async (e) => {
        const sortType = (e.target as HTMLSelectElement).value as TileSortType;
        this.currentSortType = sortType;
        await storage.set({ [TILE_SORT_KEY]: sortType });
        this.loadTileList(container);
      });

    // View mode dropdown event
    container
      .querySelector("#wps-tile-view")
      ?.addEventListener("change", async (e) => {
        const viewMode = (e.target as HTMLSelectElement)
          .value as TileViewMode;
        this.currentViewMode = viewMode === "map" ? "map" : "grid";
        await storage.set({ [TILE_VIEW_MODE_KEY]: this.currentViewMode });
        this.loadTileList(container);
      });

    // Tile list click events
    container
      .querySelector("#wps-tile-list")
      ?.addEventListener("click", (e) => {
        // マップをドラッグした直後のクリックは無視（誤遷移防止）
        if (this.mapDragged) {
          this.mapDragged = false;
          return;
        }

        const target = e.target as HTMLElement;
        const tileCard = target.closest(".wps-card") as HTMLElement | null;

        if (tileCard?.dataset.tileX && tileCard?.dataset.tileY) {
          const tileX = parseInt(tileCard.dataset.tileX);
          const tileY = parseInt(tileCard.dataset.tileY);
          (router as any).selectedTile = { tileX, tileY };
          router.navigate("tile-snapshots");
        }
      });
  }

  private showImportExportMenu(
    anchor: HTMLElement,
    router: TimeTravelRouter,
  ): void {
    // 既存メニューがあれば閉じる
    const existing = document.getElementById("wps-snapshot-io-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = document.createElement("div");
    menu.id = "wps-snapshot-io-menu";
    menu.className = "menu bg-base-200 rounded-box shadow-lg p-2";
    menu.style.cssText = "position:absolute;z-index:20;min-width:10rem;";
    menu.innerHTML = t`
      <li><button id="wps-snapshot-export-action" class="btn btn-ghost btn-sm justify-start w-full">📤 <span>${"export"}</span></button></li>
      <li><button id="wps-snapshot-import-action" class="btn btn-ghost btn-sm justify-start w-full">📥 ${"import"}</button></li>
    `;

    // anchorの下に配置
    anchor.parentElement!.style.position = "relative";
    const rect = anchor.getBoundingClientRect();
    const parentRect = anchor.parentElement!.getBoundingClientRect();
    menu.style.top = `${rect.bottom - parentRect.top}px`;
    menu.style.left = `${rect.left - parentRect.left}px`;

    anchor.parentElement!.appendChild(menu);

    // Export
    menu
      .querySelector("#wps-snapshot-export-action")!
      .addEventListener("click", (e) => {
        menu.remove();
        runSnapshotExport(e.currentTarget as HTMLButtonElement, {
          scope: "all",
        });
      });

    // Import
    menu
      .querySelector("#wps-snapshot-import-action")!
      .addEventListener("click", () => {
        menu.remove();
        router.navigate("import-snapshot");
      });

    // 外部クリックで閉じる
    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== anchor) {
        menu.remove();
        document.removeEventListener("click", closeMenu);
      }
    };
    requestAnimationFrame(() => document.addEventListener("click", closeMenu));
  }

  private sortTiles(
    tiles: TileSnapshotInfo[],
    tileNames: Map<string, string>,
  ): TileSnapshotInfo[] {
    const sorted = [...tiles];

    switch (this.currentSortType) {
      case "distance": {
        // 距離が近い順
        const currentPos = getCurrentPosition();
        if (!currentPos) return sorted;

        // 現在位置をタイル座標に変換
        const { TLX: currentTileX, TLY: currentTileY } = latLngToTilePixel(
          currentPos.lat,
          currentPos.lng,
        );

        return sorted.sort((a, b) => {
          const aDistance = Math.sqrt(
            Math.pow(a.tileX - currentTileX, 2) +
              Math.pow(a.tileY - currentTileY, 2),
          );
          const bDistance = Math.sqrt(
            Math.pow(b.tileX - currentTileX, 2) +
              Math.pow(b.tileY - currentTileY, 2),
          );

          return aDistance - bDistance;
        });
      }

      case "last_updated": {
        // 最近保存した順（各タイルの最新スナップショットのtimestampを比較）
        return sorted.sort((a, b) => {
          const aLatest = a.snapshots[0]?.timestamp || 0;
          const bLatest = b.snapshots[0]?.timestamp || 0;
          return bLatest - aLatest;
        });
      }

      case "tile_count":
        // タイル数が多い順
        return sorted.sort((a, b) => b.count - a.count);

      case "name": {
        // 名前順（タイトルがあるもの優先、アルファベット順）
        return sorted.sort((a, b) => {
          const nameKeyA = `${a.tileX}_${a.tileY}`;
          const nameKeyB = `${b.tileX}_${b.tileY}`;
          const aName = tileNames.get(nameKeyA)?.toLowerCase() || "";
          const bName = tileNames.get(nameKeyB)?.toLowerCase() || "";

          // 名前がない場合は後ろに
          if (!aName && !bName) return 0;
          if (!aName) return 1;
          if (!bName) return -1;

          return aName.localeCompare(bName);
        });
      }

      default:
        return sorted;
    }
  }

  private renderEmptyState(
    listContainer: HTMLElement,
    container: HTMLElement,
  ): void {
    const tutorialGifUrl = runtime.getURL(
      "assets/images/tutorial/how_to_archive.gif",
    );

    listContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; gap: 2rem; min-height: 300px; grid-column: 1 / -1;">
        <img src="${tutorialGifUrl}" alt="How to archive" style="width: 18rem; height: auto; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">

        <div style="text-align: center; max-width: 400px;">
          <p style="font-size: 1rem; margin-bottom: 0.5rem;">${t`${"empty_archive_message"}`}</p>
        </div>
      </div>
    `;

    this.tutorial.createButton(container);
  }

  private async loadTileList(container: HTMLElement): Promise<void> {
    try {
      const tiles = await TimeTravelStorage.getAllTilesWithSnapshotMetadata();

      // 名称一括取得（効率化）
      const tileNames = await TileNameStorage.getTileNames(
        tiles.map((t) => ({ tileX: t.tileX, tileY: t.tileY })),
      );

      // 描画状態一括取得（効率化：タイルごとにstorage.get()を呼ばない）
      const drawStates = await TimeTravelStorage.getDrawStates();

      // ソート処理
      const sortedTiles = this.sortTiles(tiles, tileNames);

      const listContainer = container.querySelector(
        "#wps-tile-list",
      ) as HTMLElement;
      if (!listContainer) return;

      this.cleanup();

      if (sortedTiles.length === 0) {
        this.renderEmptyState(listContainer, container);
        return;
      }

      if (this.currentViewMode === "map") {
        listContainer.innerHTML = this.renderMapView(
          sortedTiles,
          tileNames,
          drawStates,
        );
        this.initMapView(listContainer);
      } else {
        const renderedTiles = sortedTiles.map((tile) =>
          this.renderTileCard(tile, tileNames, drawStates),
        );
        // コンパクトなカード。幅は画面幅に応じて可変（約120〜160px）、
        // 高さは最低70pxで内容に追従する（auto-rows を max 固定にすると
        // align-items:stretch で常に最大まで伸びて正方形化してしまうため auto にする）。
        listContainer.innerHTML = `<div id="wps-tile-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); grid-auto-rows: minmax(70px, auto); gap: 0.5rem; justify-content: center;">${renderedTiles.join("")}</div>`;

        // 画面内に入った分だけサムネを後付け（root 未指定＝ビューポート基準。
        // 祖先のスクロールによるクリッピングも考慮される）
        this.thumbnailHandle = attachSnapshotThumbnails(listContainer, null);
      }
    } catch (error) {
      console.error("🧑‍🎨 : Failed to load tile list:", error);
      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-error text-center p-4">Failed to load tiles</div>`;
      }
    }
  }

  /**
   * 実座標を正規化し、全体を1画面にフィットさせた「簡易マップ」を作る。
   * 配置は絶対座標＋transform(scale) で行い、ズーム/パンできる。
   */
  private renderMapView(
    tiles: TileSnapshotInfo[],
    tileNames: Map<string, string>,
    drawStates: SnapshotDrawState[],
  ): string {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const tile of tiles) {
      if (tile.tileX < minX) minX = tile.tileX;
      if (tile.tileX > maxX) maxX = tile.tileX;
      if (tile.tileY < minY) minY = tile.tileY;
      if (tile.tileY > maxY) maxY = tile.tileY;
    }

    const cols = Math.max(1, maxX - minX + 1);
    const rows = Math.max(1, maxY - minY + 1);
    const worldW = cols * MAP_CELL;
    const worldH = rows * MAP_CELL;

    const mapTiles = tiles.map((tile) =>
      this.renderMapTile(
        tile,
        tileNames,
        drawStates,
        (tile.tileX - minX) * MAP_CELL,
        (tile.tileY - minY) * MAP_CELL,
      ),
    );

    return `
      <div
        id="wps-map-viewport"
        class="bg-base-200"
        style="position: relative; width: 100%; height: min(62vh, 560px); min-height: 300px; overflow: hidden; border-radius: 10px; touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none;"
      >
        <div
          id="wps-map-world"
          data-world-w="${worldW}"
          data-world-h="${worldH}"
          style="position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; z-index: 2; opacity: 0; pointer-events: none; transition: opacity 0.15s ease;"
        >
          ${mapTiles.join("")}
        </div>

        <canvas
          id="wps-map-canvas"
          style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"
        ></canvas>

        <div style="position: absolute; right: 8px; bottom: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 5;">
          <button data-map-action="in" class="btn btn-sm btn-circle" title="+">+</button>
          <button data-map-action="out" class="btn btn-sm btn-circle" title="−">−</button>
          <button data-map-action="reset" class="btn btn-sm btn-circle" title="${t`${"view_map"}`}">⤢</button>
        </div>

        <div style="position: absolute; left: 8px; bottom: 8px; z-index: 5; font-size: 11px; color: #94a3b8; background: rgba(0,0,0,0.35); padding: 2px 6px; border-radius: 6px; pointer-events: none;">
          ${cols} × ${rows}
        </div>
      </div>
    `;
  }

  private renderMapTile(
    tile: TileSnapshotInfo,
    tileNames: Map<string, string>,
    drawStates: SnapshotDrawState[],
    left: number,
    top: number,
  ): string {
    const hasActiveSnapshot = drawStates.some(
      (s) => s.tileX === tile.tileX && s.tileY === tile.tileY && s.drawEnabled,
    );

    const nameKey = `${tile.tileX}_${tile.tileY}`;
    const displayName = tileNames.get(nameKey) || `${tile.tileX}, ${tile.tileY}`;
    const safeName = escapeHtml(displayName);

    const thumbnailId = ENABLE_SNAPSHOT_THUMBNAILS
      ? tile.snapshots[0]?.id
      : undefined;

    // サムネはタイル全面の背景として敷く（画面上で十分大きい時だけ遅延取得）
    const thumb = thumbnailId
      ? `<div class="wps-thumb" data-thumb-id="${thumbnailId}" data-thumb-opacity="0.95" style="position:absolute; inset:0; z-index:0;"></div>`
      : "";

    return `
      <div
        class="wps-card wps-map-tile"
        data-id="${tile.tileX}_${tile.tileY}"
        data-tile-x="${tile.tileX}"
        data-tile-y="${tile.tileY}"
        data-count="${tile.count}"
        data-active="${hasActiveSnapshot ? "1" : "0"}"
        data-snap-thumb="${thumbnailId || ""}"
        title="${safeName}"
        style="position: absolute; left: ${left}px; top: ${top}px; width: ${MAP_CELL - MAP_GAP}px; height: ${MAP_CELL - MAP_GAP}px; border-radius: 6px; overflow: hidden; cursor: pointer; background: rgba(100,116,139,0.15); box-shadow: 0 1px 2px rgba(0,0,0,0.15); -webkit-tap-highlight-color: transparent;"
      >
        ${thumb}
        <div style="position:absolute; left:0; right:0; bottom:0; z-index:1; padding:1px 4px; font-size:10px; line-height:1.2; color:#fff; background:linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0)); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none;">${safeName}</div>
        <div style="position:absolute; top:2px; right:2px; z-index:1; background:rgba(17,24,39,0.62); color:#fff; border-radius:9px; padding:0 5px; font-size:10px; font-weight:500; pointer-events:none;">${tile.count}</div>
        ${
          hasActiveSnapshot
            ? `<div style="position:absolute; top:3px; left:3px; z-index:1; width:7px; height:7px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 1.5px rgba(255,255,255,0.7); pointer-events:none;"></div>`
            : ""
        }
      </div>
    `;
  }

  /** map の初期化（fit + ズーム/パン操作の配線） */
  private initMapView(listContainer: HTMLElement): void {
    const viewport = listContainer.querySelector<HTMLElement>(
      "#wps-map-viewport",
    );
    const world = listContainer.querySelector<HTMLElement>("#wps-map-world");
    const canvas = listContainer.querySelector<HTMLCanvasElement>(
      "#wps-map-canvas",
    );
    if (!viewport || !world || !canvas) return;

    this.mapViewport = viewport;
    this.mapWorld = world;
    this.mapCanvas = canvas;
    this.mapWorldW = parseFloat(world.dataset.worldW || "1") || 1;
    this.mapWorldH = parseFloat(world.dataset.worldH || "1") || 1;

    // 各タイルの中心（ワールド座標）を集めておく（ズームアウト時のドット描画・クリック判定用）
    const half = (MAP_CELL - MAP_GAP) / 2;
    this.mapPoints = Array.from(
      world.querySelectorAll<HTMLElement>(".wps-map-tile"),
    ).map((el) => ({
      x: (parseFloat(el.style.left) || 0) + half,
      y: (parseFloat(el.style.top) || 0) + half,
      count: parseInt(el.dataset.count || "0", 10) || 0,
      active: el.dataset.active === "1",
      tileX: parseInt(el.dataset.tileX || "0", 10) || 0,
      tileY: parseInt(el.dataset.tileY || "0", 10) || 0,
      name: el.title || "",
      thumbnailId: el.dataset.snapThumb || undefined,
    }));

    // 大陸シルエットを、タイルと同じローカル座標（MAP_CELL 単位）へ投影しておく。
    // 原点は保存タイルの最小タイル座標に合わせる（タイルと同じ位置に載る）。
    let minTileX = Infinity;
    let minTileY = Infinity;
    for (const p of this.mapPoints) {
      if (p.tileX < minTileX) minTileX = p.tileX;
      if (p.tileY < minTileY) minTileY = p.tileY;
    }
    if (!Number.isFinite(minTileX)) {
      minTileX = 0;
      minTileY = 0;
    }
    this.mapLand = WORLD_LAND_RINGS.map((ring) => {
      const out: number[] = [];
      for (let i = 0; i < ring.length; i += 2) {
        // 緯度はメルカトルの限界でクランプ（極で Infinity になるのを防ぐ）
        const lat = Math.max(-85.05112878, Math.min(85.05112878, ring[i + 1] / 100));
        const [px, py] = latLonToPixels(lat, ring[i] / 100);
        out.push(
          (px / TILE_SIZE - minTileX) * MAP_CELL,
          (py / TILE_SIZE - minTileY) * MAP_CELL,
        );
      }
      return out;
    });

    // 初期は最小スケールで配置（この時点ではサムネを読まない）
    this.mapScale = MAP_MIN_SCALE;
    this.applyMapTransform();

    // 全体が収まるようフィット（即時＋レイアウト確定後にもう一度）
    this.fitMap();
    requestAnimationFrame(() => this.fitMap());

    // ズームアウト時（ドット表示）は、ドットをクリックするとポップアップで
    // 名前/座標/枚数を出し、そのまま開けるようにする。
    viewport.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-map-action], .wps-map-popover")) return;
      if (this.mapDetail) return; // 拡大時はカード側のクリック処理に任せる
      if (this.mapDragged) return; // ドラッグ直後は無視（mapDragged はカード側で解除）

      const rect = viewport.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const hit = this.hitTestCluster(px, py);
      if (!hit) {
        this.hideMapPopover();
        return;
      }
      // まとまっている時は、その範囲へ拡大して個別タイルに分ける
      if (hit.n > 1) {
        this.hideMapPopover();
        this.zoomToWorldRect(hit.minX, hit.minY, hit.maxX, hit.maxY);
        return;
      }
      this.showMapPopover(hit, px, py, viewport);
    });

    viewport
      .querySelectorAll<HTMLButtonElement>("[data-map-action]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = btn.dataset.mapAction;
          if (action === "in") this.zoomMap(1.4);
          else if (action === "out") this.zoomMap(1 / 1.4);
          else this.fitMap();
        });
      });

    viewport.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.hideMapPopover();
        this.zoomMapAt(
          e.clientX,
          e.clientY,
          e.deltaY < 0 ? 1.15 : 1 / 1.15,
          viewport,
        );
      },
      { passive: false },
    );

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTx = 0;
    let startTy = 0;
    let moved = 0;

    viewport.addEventListener("pointerdown", (e) => {
      if (
        (e.target as HTMLElement).closest(
          "[data-map-action], .wps-map-popover",
        )
      ) {
        return;
      }
      this.hideMapPopover();
      this.mapDragged = false;
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startY = e.clientY;
      startTx = this.mapTx;
      startTy = this.mapTy;
      viewport.style.cursor = "grabbing";
    });

    // ズームアウト時のドット上ではカーソルを pointer に変える（クリック誘導）
    viewport.addEventListener("pointermove", (e) => {
      if (dragging) return;
      if (this.mapDetail) {
        viewport.style.cursor = "grab";
        return;
      }
      const rect = viewport.getBoundingClientRect();
      const hit = this.hitTestCluster(
        e.clientX - rect.left,
        e.clientY - rect.top,
      );
      viewport.style.cursor = hit ? "pointer" : "grab";
    });

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      this.mapTx = startTx + dx;
      this.mapTy = startTy + dy;
      this.applyMapTransform();
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      if (viewport.isConnected) viewport.style.cursor = "grab";
      // ドラッグと判定したら、この直後の click を無効化する
      // （次の pointerdown か、click 処理側でリセットされる）
      if (moved > 6) this.mapDragged = true;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    this.mapPointerMove = onMove;
    this.mapPointerUp = onUp;

    const onResize = () => this.fitMap();
    window.addEventListener("resize", onResize);
    this.mapResize = onResize;
  }

  /** 全体が1画面に収まるようフィットさせる */
  private fitMap(): void {
    const viewport = this.mapViewport;
    if (!viewport) return;

    const vw = viewport.clientWidth || 320;
    const vh = viewport.clientHeight || 320;
    const pad = 12;

    const fit = Math.min(
      (vw - pad * 2) / this.mapWorldW,
      (vh - pad * 2) / this.mapWorldH,
    );
    const scale = Math.min(MAP_MAX_SCALE, Math.max(MAP_MIN_SCALE, fit));

    this.mapScale = scale;
    this.mapTx = (vw - this.mapWorldW * scale) / 2;
    this.mapTy = (vh - this.mapWorldH * scale) / 2;
    this.applyMapTransform();
  }

  private zoomMap(factor: number): void {
    const viewport = this.mapViewport;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    this.zoomMapAt(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
      factor,
      viewport,
    );
  }

  private zoomMapAt(
    clientX: number,
    clientY: number,
    factor: number,
    viewport: HTMLElement,
  ): void {
    const rect = viewport.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    const worldX = (px - this.mapTx) / this.mapScale;
    const worldY = (py - this.mapTy) / this.mapScale;

    const next = Math.min(
      MAP_MAX_SCALE,
      Math.max(MAP_MIN_SCALE, this.mapScale * factor),
    );
    this.mapScale = next;
    this.mapTx = px - worldX * next;
    this.mapTy = py - worldY * next;
    this.applyMapTransform();
  }

  private applyMapTransform(): void {
    const world = this.mapWorld;
    if (!world) return;
    world.style.transform = `translate(${this.mapTx}px, ${this.mapTy}px) scale(${this.mapScale})`;
    this.syncMapDetail();
  }

  /**
   * 画面上のセルが十分大きい時だけ、可視範囲のサムネを遅延取得する。
   * 全体表示（縮小しすぎ）ではカードは見えず、代わりに canvas に方眼と
   * 固定サイズのドットを描いて「まとまって」見えるようにする。
   */
  private syncMapDetail(): void {
    const viewport = this.mapViewport;
    const world = this.mapWorld;
    if (!viewport || !world) return;

    const shouldDetail = MAP_CELL * this.mapScale >= MAP_DETAIL_CELL_PX;

    if (shouldDetail !== this.mapDetail) {
      this.mapDetail = shouldDetail;
      this.detachThumbnails();

      if (shouldDetail) {
        world.style.opacity = "1";
        world.style.pointerEvents = "auto";
        this.thumbnailHandle = attachSnapshotThumbnails(viewport, viewport);
      } else {
        world.style.opacity = "0";
        world.style.pointerEvents = "none";
      }
    }

    // 方眼（簡易世界地図っぽい背景）と、縮小時のドットを描く
    this.drawOverlay();
  }

  /**
   * canvas に大陸のシルエット（ワイヤーフレーム）を描く（常時）。
   * タイルと同じメルカトル座標系なので、保存タイルの位置と地理的に一致する。
   * 続けて、縮小時はタイルのドットも描く。
   */
  private drawOverlay(): void {
    const canvas = this.mapCanvas;
    const viewport = this.mapViewport;
    if (!canvas || !viewport) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    if (vw <= 0 || vh <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.round(vw * dpr);
    const pixelH = Math.round(vh * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    const scale = this.mapScale;
    if (scale <= 0) return;

    this.drawWorldLand(ctx, scale);

    // --- タイル: 全体表示（縮小）のときだけ。近接はクラスタ化して大きめに描く ---
    if (this.mapDetail) return;

    // クラスタは scale にのみ依存するので、パン中は再計算しない
    if (scale !== this.mapClusterScale) {
      this.mapClusters = this.computeClusters(scale);
      this.mapClusterScale = scale;
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 10px system-ui, -apple-system, 'Segoe UI', sans-serif";

    for (const cluster of this.mapClusters) {
      const sx = cluster.x * scale + this.mapTx;
      const sy = cluster.y * scale + this.mapTy;
      const r = this.clusterRadius(cluster.n);
      if (sx < -r || sy < -r || sx > vw + r || sy > vh + r) continue;

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = cluster.active ? "#22c55e" : "#3b82f6";
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      // 白フチ: 大陸の上でも視認しやすいように
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.stroke();

      // まとまっている時は件数を出す（押しやすいサイズの時だけ）
      if (cluster.n > 1 && r >= 8) {
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${cluster.n}`, sx, sy + 0.5);
      }
    }
  }

  /** 投影済みの大陸リングを canvas に描く（塗り＋輪郭のシルエット） */
  private drawWorldLand(ctx: CanvasRenderingContext2D, scale: number): void {
    const land = this.mapLand;
    if (land.length === 0) return;

    const tx = this.mapTx;
    const ty = this.mapTy;
    // アンチメリディアン（経度の折り返し）で画面を横切る線を描かないための閾値
    const wrap = (MAP_WORLD_TILES * MAP_CELL) / 2;

    ctx.beginPath();
    for (const ring of land) {
      let prevLx = 0;
      for (let i = 0; i < ring.length; i += 2) {
        const lx = ring[i];
        const ly = ring[i + 1];
        const sx = lx * scale + tx;
        const sy = ly * scale + ty;
        if (i === 0 || Math.abs(lx - prevLx) > wrap) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
        prevLx = lx;
      }
      ctx.closePath();
    }

    ctx.fillStyle = "rgba(100,116,139,0.10)";
    ctx.fill("evenodd");
    ctx.strokeStyle = "rgba(100,116,139,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /** クラスタの半径（画面 px）。数が多いほど大きく、押しやすくする */
  private clusterRadius(n: number): number {
    return Math.min(
      MAP_CLUSTER_MAX_R,
      MAP_CLUSTER_MIN_R + Math.log2(n) * 2.4,
    );
  }

  /**
   * 近接タイルをまとめる。ワールド座標のグリッドで行うので scale にのみ依存し、
   * パン中は再計算不要（scale が変わった時だけ呼ぶ）。
   */
  private computeClusters(scale: number): MapCluster[] {
    const cell = MAP_CLUSTER_PX / scale;
    const single = (p: MapPoint): MapCluster => ({
      x: p.x,
      y: p.y,
      n: 1,
      count: p.count,
      active: p.active,
      lead: p,
      minX: p.x,
      minY: p.y,
      maxX: p.x,
      maxY: p.y,
    });
    if (!Number.isFinite(cell) || cell <= 0) {
      return this.mapPoints.map(single);
    }

    interface Bucket {
      sx: number;
      sy: number;
      members: MapPoint[];
      count: number;
      active: boolean;
      minX: number;
      minY: number;
      maxX: number;
      maxY: number;
    }
    const buckets = new Map<string, Bucket>();

    for (const p of this.mapPoints) {
      const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
      let b = buckets.get(key);
      if (!b) {
        b = {
          sx: 0,
          sy: 0,
          members: [],
          count: 0,
          active: false,
          minX: p.x,
          minY: p.y,
          maxX: p.x,
          maxY: p.y,
        };
        buckets.set(key, b);
      }
      b.sx += p.x;
      b.sy += p.y;
      b.count += p.count;
      b.active = b.active || p.active;
      if (p.x < b.minX) b.minX = p.x;
      if (p.y < b.minY) b.minY = p.y;
      if (p.x > b.maxX) b.maxX = p.x;
      if (p.y > b.maxY) b.maxY = p.y;
      b.members.push(p);
    }

    const clusters: MapCluster[] = [];
    for (const b of buckets.values()) {
      const n = b.members.length;
      const cx = b.sx / n;
      const cy = b.sy / n;
      // 代表は「重心に最も近いタイル」（あれば名前・サムネが使える）
      let lead = b.members[0];
      let bestDist = Infinity;
      for (const m of b.members) {
        const d = (m.x - cx) ** 2 + (m.y - cy) ** 2;
        if (d < bestDist) {
          bestDist = d;
          lead = m;
        }
      }
      clusters.push({
        x: cx,
        y: cy,
        n,
        count: b.count,
        active: b.active,
        lead,
        minX: b.minX,
        minY: b.minY,
        maxX: b.maxX,
        maxY: b.maxY,
      });
    }
    return clusters;
  }

  /** 画面上の座標に最も近いクラスタを返す（無ければ null） */
  private hitTestCluster(px: number, py: number): MapCluster | null {
    let best: MapCluster | null = null;
    let bestDist = Infinity;
    for (const cluster of this.mapClusters) {
      const sx = cluster.x * this.mapScale + this.mapTx;
      const sy = cluster.y * this.mapScale + this.mapTy;
      // 小さくても押しやすいように、半径＋余白で判定
      const hit = Math.max(this.clusterRadius(cluster.n) + 8, 16);
      const d = (sx - px) ** 2 + (sy - py) ** 2;
      if (d <= hit * hit && d < bestDist) {
        bestDist = d;
        best = cluster;
      }
    }
    return best;
  }

  /** 指定したワールド矩形が画面に収まるように拡大する（必ず今より拡大） */
  private zoomToWorldRect(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void {
    const viewport = this.mapViewport;
    if (!viewport) return;

    const vw = viewport.clientWidth || 320;
    const vh = viewport.clientHeight || 320;
    const pad = MAP_CELL;
    const w = Math.max(maxX - minX + MAP_CELL, MAP_CELL);
    const h = Math.max(maxY - minY + MAP_CELL, MAP_CELL);

    const fit = Math.min((vw - pad) / w, (vh - pad) / h);
    // 同じクラスタで止まらないよう、最低でも2倍に拡大する
    const next = Math.min(
      MAP_MAX_SCALE,
      Math.max(MAP_MIN_SCALE, Math.max(fit, this.mapScale * 2)),
    );

    this.mapScale = next;
    this.mapTx = vw / 2 - ((minX + maxX) / 2) * next;
    this.mapTy = vh / 2 - ((minY + maxY) / 2) * next;
    this.applyMapTransform();
  }

  /** ズームアウト時のマーカーをクリックしたときの簡易ポップアップ */
  private showMapPopover(
    cluster: MapCluster,
    px: number,
    py: number,
    viewport: HTMLElement,
  ): void {
    this.hideMapPopover();

    const point = cluster.lead;
    const name = point.name || `${point.tileX}, ${point.tileY}`;
    const thumbId = point.thumbnailId;

    const pop = document.createElement("div");
    pop.className = "wps-map-popover";
    pop.style.cssText = [
      "position: absolute",
      "z-index: 20",
      "width: 168px",
      "padding: 8px",
      "border-radius: 10px",
      "background: var(--fallback-b1, #ffffff)",
      "color: var(--fallback-bc, #1f2937)",
      "box-shadow: 0 6px 20px rgba(0,0,0,0.22)",
      "font-size: 12px",
      "line-height: 1.3",
      "display: flex",
      "flex-direction: column",
      "justify-content: flex-end",
      "gap: 2px",
      "background-size: cover",
      "background-position: center",
      // サムネを背景に敷くので、文字が読めるよう最低限の高さを確保
      thumbId ? "min-height: 108px" : "",
    ]
      .filter(Boolean)
      .join(";");

    pop.innerHTML = `
      ${
        cluster.n > 1
          ? `<div class="wps-map-pop-sub" style="color:#94a3b8;">${cluster.n} ${t`${"tiles"}`}</div>`
          : ""
      }
      <div style="font-weight:600; word-break:break-word;">${escapeHtml(name)}</div>
      <div class="wps-map-pop-sub" style="color:#94a3b8;">📍${point.tileX}, ${point.tileY} ・ ${point.count}</div>
      <div style="display:flex; gap:4px; margin-top:4px;">
        <button class="btn btn-xs btn-primary wps-map-open" style="flex:1; min-width:0;">${t`${"open"}`}</button>
        ${
          cluster.n > 1
            ? `<button class="btn btn-xs wps-map-zoom" style="flex:1; min-width:0;">${t`${"zoom_in"}`}</button>`
            : ""
        }
      </div>
    `;

    // 上に出す。上に余白が無ければ下に出す。左右は画面内にクランプ。
    const vw = viewport.clientWidth;
    const halfW = 88;
    const left = Math.max(halfW + 4, Math.min(px, vw - halfW - 4));
    const below = py < 96 + (thumbId ? 24 : 0);
    pop.style.left = `${left}px`;
    pop.style.top = `${py}px`;
    pop.style.transform = below
      ? "translate(-50%, 12px)"
      : "translate(-50%, calc(-100% - 12px))";

    pop.querySelector(".wps-map-open")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideMapPopover();
      const router = this.router;
      if (!router) return;
      (router as any).selectedTile = { tileX: point.tileX, tileY: point.tileY };
      router.navigate("tile-snapshots");
    });

    pop.querySelector(".wps-map-zoom")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hideMapPopover();
      this.zoomToWorldRect(
        cluster.minX,
        cluster.minY,
        cluster.maxX,
        cluster.maxY,
      );
    });

    viewport.appendChild(pop);
    this.mapPopover = pop;

    // サムネがあるタイルなら、それをポップアップの背景に敷く
    // （上に暗いグラデを重ねて、白文字が読めるようにする）
    if (thumbId) {
      void getThumbnailDataUrl(thumbId).then((url) => {
        if (!url || this.mapPopover !== pop || !pop.isConnected) return;
        pop.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.32), rgba(0,0,0,0.74)), url("${url}")`;
        pop.style.color = "#ffffff";
        pop
          .querySelectorAll<HTMLElement>(".wps-map-pop-sub")
          .forEach((el) => {
            el.style.color = "rgba(255,255,255,0.85)";
          });
      });
    }
  }

  private hideMapPopover(): void {
    if (this.mapPopover) {
      this.mapPopover.remove();
      this.mapPopover = null;
    }
  }

  private renderTileCard(
    tile: TileSnapshotInfo,
    tileNames: Map<string, string>,
    drawStates: SnapshotDrawState[],
  ): string {
    const hasActiveSnapshot = drawStates.some(
      (s) => s.tileX === tile.tileX && s.tileY === tile.tileY && s.drawEnabled,
    );

    const nameKey = `${tile.tileX}_${tile.tileY}`;
    const tileName = tileNames.get(nameKey);
    const displayName = tileName || `Tile(${tile.tileX}, ${tile.tileY})`;

    const cardConfig: CardConfig = {
      id: `${tile.tileX}_${tile.tileY}`,
      title: displayName,
      subtitle: `📍${tile.tileX}, ${tile.tileY}`,
      badge: `${tile.count}`,
      hasActiveIcon: hasActiveSnapshot,
      onClick: true,
      thumbnailId: ENABLE_SNAPSHOT_THUMBNAILS
        ? tile.snapshots[0]?.id
        : undefined,
      data: {
        "tile-x": tile.tileX.toString(),
        "tile-y": tile.tileY.toString(),
      },
    };

    return createCard(cardConfig);
  }
}
