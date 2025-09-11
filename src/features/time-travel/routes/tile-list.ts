import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, TileSnapshotInfo } from "../storage";
import { t } from "../../../i18n/manager";

export class TileListRoute {
  render(container: HTMLElement, router: TimeTravelRouter): void {
    container.innerHTML = t`
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
    container.querySelector("#wps-tile-list")?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const tileItem = target.closest(".tile-item") as HTMLElement | null;
      
      if (tileItem?.dataset.tileX && tileItem?.dataset.tileY) {
        const tileX = parseInt(tileItem.dataset.tileX);
        const tileY = parseInt(tileItem.dataset.tileY);
        
        // 選択されたタイル情報を保存してスナップショット一覧に遷移
        (router as any).selectedTile = { tileX, tileY };
        router.navigate("tile-snapshots");
      }
    });
  }

  private async loadTileList(container: HTMLElement): Promise<void> {
    try {
      const tiles = await TimeTravelStorage.getAllTilesWithSnapshots();
      const listContainer = container.querySelector("#wps-tile-list");
      
      if (listContainer) {
        if (tiles.length === 0) {
          listContainer.innerHTML = `<div class="text-sm text-gray-500 text-center p-4">${t`${'no_items'}`}</div>`;
        } else {
          listContainer.innerHTML = tiles.map(tile => this.renderTileItem(tile)).join('');
        }
      }
    } catch (error) {
      console.error('Failed to load tile list:', error);
      const listContainer = container.querySelector("#wps-tile-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">Failed to load tiles</div>`;
      }
    }
  }

  private renderTileItem(tile: TileSnapshotInfo): string {
    return `
      <div class="tile-item border-b p-3 cursor-pointer hover:bg-gray-50 transition-colors" 
           data-tile-x="${tile.tileX}" data-tile-y="${tile.tileY}">
        <div class="flex justify-between items-center">
          <div>
            <div class="text-sm font-medium">タイル(${tile.tileX}, ${tile.tileY})</div>
            <div class="text-xs text-gray-500">${tile.count}個のスナップショット</div>
          </div>
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 text-gray-400">
              <path fill-rule="evenodd" d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      </div>
    `;
  }
}
