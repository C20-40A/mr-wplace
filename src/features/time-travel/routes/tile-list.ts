import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, TileSnapshotInfo } from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "../../../i18n/manager";

export class TileListRoute {
  render(container: HTMLElement, router: TimeTravelRouter): void {
    container.innerHTML = t`
      <div class="mb-2">
        <button id="wps-import-snapshot-btn" class="btn btn-sm btn-neutral">
          ${'import'}
        </button>
      </div>
      <div class="max-h-80 overflow-y-auto border rounded p-2">
        <div id="wps-tile-list">
          <div class="text-sm text-gray-500 text-center p-4">${"loading"}</div>
        </div>
      </div>
    `;

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

    // Tile list click events
    container
      .querySelector("#wps-tile-list")
      ?.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const tileItem = target.closest(".tile-item") as HTMLElement | null;

        if (tileItem?.dataset.tileX && tileItem?.dataset.tileY) {
          const tileX = parseInt(tileItem.dataset.tileX);
          const tileY = parseInt(tileItem.dataset.tileY);
          (router as any).selectedTile = { tileX, tileY };
          router.navigate("tile-snapshots");
        }
      });
  }

  private async loadTileList(container: HTMLElement): Promise<void> {
    try {
      const tiles = await TimeTravelStorage.getAllTilesWithSnapshots();

      // 名称一括取得（効率化）
      const tileNames = await TileNameStorage.getTileNames(
        tiles.map((t) => ({ tileX: t.tileX, tileY: t.tileY }))
      );

      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        if (tiles.length === 0) {
          listContainer.innerHTML = `<div class="text-sm text-gray-500 text-center p-4">${t`${"no_items"}`}</div>`;
        } else {
          listContainer.innerHTML = tiles
            .map((tile) => this.renderTileItem(tile, tileNames))
            .join("");
        }
      }
    } catch (error) {
      console.error("Failed to load tile list:", error);
      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">Failed to load tiles</div>`;
      }
    }
  }

  private renderTileItem(
    tile: TileSnapshotInfo,
    tileNames: Map<string, string>
  ): string {
    const tileOverlay = (window as any).wplaceStudio?.tileOverlay;
    const snapshotDrawing =
      tileOverlay?.templateManager?.findSnapshotDrawingInTile(
        tile.tileX,
        tile.tileY
      );

    const nameKey = `${tile.tileX}_${tile.tileY}`;
    const tileName = tileNames.get(nameKey);
    const displayName = tileName || `タイル(${tile.tileX}, ${tile.tileY})`;

    return `
      <div class="tile-item p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-200 last:border-b-0" 
           data-tile-x="${tile.tileX}" data-tile-y="${tile.tileY}">
        <div class="flex items-center justify-between">
          <!-- 名称部分 -->
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <span class="font-medium text-base">${displayName}</span>
              ${
                snapshotDrawing.isTemplateActive
                  ? `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 text-green-500">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd" />
                </svg>
              `
                  : ""
              }
            </div>
          </div>
          
          <!-- 座標部分 -->
          <div class="text-sm text-gray-600 min-w-0 px-3">
            (${tile.tileX}, ${tile.tileY})
          </div>
          
          <!-- Total部分 -->
          <div class="text-sm text-gray-500 min-w-0">
            Total: ${tile.count}
          </div>
          
          <!-- 矢印アイコン -->
          <div class="ml-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 text-gray-400">
              <path fill-rule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    `;
  }
}
