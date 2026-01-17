import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, TileSnapshotInfo } from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "@/i18n/manager";
import { createCard, CardConfig } from "@/components/card";
import { storage, runtime } from "@/utils/browser-api";
import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { Tutorial } from "@/features/tutorial";

type TileSortType = "distance" | "last_updated" | "tile_count" | "name";
const TILE_SORT_KEY = "wplace-studio-tile-sort";

export class TileListRoute {
  private currentSortType: TileSortType = "distance";
  private tutorial: Tutorial;

  constructor() {
    this.tutorial = new Tutorial();
  }

  async render(
    container: HTMLElement,
    router: TimeTravelRouter
  ): Promise<void> {
    // Load saved sort type
    const result = await storage.get([TILE_SORT_KEY]);
    this.currentSortType = result[TILE_SORT_KEY] || "tile_count";

    container.innerHTML = t`
      <div class="mb-2" style="display: flex; gap: 0.5rem; align-items: center;">
        <button id="wps-import-snapshot-btn" class="btn btn-sm btn-neutral">
          ${"import"}
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
      </div>
      <div style="overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; padding: 0.5rem; min-height: 400px;">
        <div id="wps-tile-list" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
          <div class="text-sm text-base-content/60 text-center p-4" style="grid-column: 1 / -1;">${"loading"}</div>
        </div>
      </div>
    `;

    // Set sort dropdown value
    const sortSelect = container.querySelector(
      "#wps-tile-sort"
    ) as HTMLSelectElement;
    if (sortSelect) sortSelect.value = this.currentSortType;

    this.setupEvents(container, router);
    this.loadTileList(container);
  }

  private setupEvents(container: HTMLElement, router: TimeTravelRouter): void {
    // Import button event
    container
      .querySelector("#wps-import-snapshot-btn")
      ?.addEventListener("click", () => {
        router.navigate("import-snapshot");
      });

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

    // Tile list click events
    container
      .querySelector("#wps-tile-list")
      ?.addEventListener("click", (e) => {
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

  private sortTiles(
    tiles: TileSnapshotInfo[],
    tileNames: Map<string, string>
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
          currentPos.lng
        );

        return sorted.sort((a, b) => {
          const aDistance = Math.sqrt(
            Math.pow(a.tileX - currentTileX, 2) +
              Math.pow(a.tileY - currentTileY, 2)
          );
          const bDistance = Math.sqrt(
            Math.pow(b.tileX - currentTileX, 2) +
              Math.pow(b.tileY - currentTileY, 2)
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

  private renderEmptyState(listContainer: HTMLElement, container: HTMLElement): void {
    const tutorialGifUrl = runtime.getURL("assets/images/tutorial/how_to_archive.gif");

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
      const tiles = await TimeTravelStorage.getAllTilesWithSnapshots();

      // 名称一括取得（効率化）
      const tileNames = await TileNameStorage.getTileNames(
        tiles.map((t) => ({ tileX: t.tileX, tileY: t.tileY }))
      );

      // ソート処理
      const sortedTiles = this.sortTiles(tiles, tileNames);

      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        if (sortedTiles.length === 0) {
          this.renderEmptyState(listContainer as HTMLElement, container);
        } else {
          const renderedTiles = await Promise.all(
            sortedTiles.map((tile) => this.renderTileCard(tile, tileNames))
          );
          listContainer.innerHTML = renderedTiles.join("");
        }
      }
    } catch (error) {
      console.error("🧑‍🎨 : Failed to load tile list:", error);
      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-error text-center p-4" style="grid-column: 1 / -1;">Failed to load tiles</div>`;
      }
    }
  }

  private async renderTileCard(
    tile: TileSnapshotInfo,
    tileNames: Map<string, string>
  ): Promise<string> {
    const activeSnapshot = await TimeTravelStorage.getActiveSnapshotForTile(
      tile.tileX,
      tile.tileY
    );

    const nameKey = `${tile.tileX}_${tile.tileY}`;
    const tileName = tileNames.get(nameKey);
    const displayName = tileName || `Tile(${tile.tileX}, ${tile.tileY})`;

    const cardConfig: CardConfig = {
      id: `${tile.tileX}_${tile.tileY}`,
      title: displayName,
      subtitle: `📍${tile.tileX}, ${tile.tileY}`,
      badge: `${tile.count}`,
      hasActiveIcon: !!activeSnapshot,
      onClick: true,
      data: {
        "tile-x": tile.tileX.toString(),
        "tile-y": tile.tileY.toString(),
      },
    };

    return createCard(cardConfig);
  }
}
