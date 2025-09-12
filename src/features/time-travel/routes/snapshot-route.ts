import { BaseSnapshotRoute } from "./base-snapshot-route";
import { TimeTravelRouter } from "../router";
import { getCurrentPosition } from "../../../utils/position";
import { TimeTravelStorage } from "../storage";
import { t } from "../../../i18n/manager";

interface SnapshotRouteOptions {
  showSaveButton: boolean;
}

export class SnapshotRoute extends BaseSnapshotRoute {
  private options: SnapshotRouteOptions;
  private currentTileX?: number;
  private currentTileY?: number;

  constructor(options: SnapshotRouteOptions) {
    super();
    this.options = options;
  }

  render(container: HTMLElement, router: TimeTravelRouter): void {
    const selectedTile = (router as any).selectedTile;

    // タイル情報を決定
    if (selectedTile) {
      this.currentTileX = selectedTile.tileX;
      this.currentTileY = selectedTile.tileY;
    } else {
      const position = getCurrentPosition();
      if (position) {
        const coords = this.calculateTileCoords(position.lat, position.lng);
        this.currentTileX = coords.TLX;
        this.currentTileY = coords.TLY;
      }
    }

    // タイル情報表示部分（特定タイルの場合のみ）
    const tileInfoHtml = selectedTile
      ? `<div class="mb-4">
           <div class="text-sm text-gray-600">タイル(${this.currentTileX}, ${this.currentTileY})のスナップショット</div>
         </div>`
      : "";

    // 保存ボタン（モードにより表示制御）
    const saveButtonHtml = this.options.showSaveButton
      ? `<div class="mb-4">
           <button id="wps-save-current-snapshot-btn" class="btn btn-primary w-full">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
               <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
               <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
             </svg>
             ${t`${"save_current_snapshot"}`}
           </button>
         </div>`
      : "";

    container.innerHTML = `
      ${tileInfoHtml}
      <div class="max-h-60 overflow-y-auto border rounded p-2">
        <div id="wps-snapshots-list">
          <div class="text-sm text-gray-500 text-center p-4">${t`${"loading"}`}</div>
        </div>
      </div>
      ${saveButtonHtml}
    `;

    this.setupEvents(container);
    this.reloadSnapshots(container);
  }

  private setupEvents(container: HTMLElement): void {
    // 保存ボタンのイベント
    if (this.options.showSaveButton) {
      container
        .querySelector("#wps-save-current-snapshot-btn")
        ?.addEventListener("click", async () => {
          await this.saveCurrentSnapshot(container);
        });
    }

    // スナップショット一覧のイベント委譲
    this.setupSnapshotEvents(container, "#wps-snapshots-list");
  }

  protected async reloadSnapshots(container: HTMLElement): Promise<void> {
    if (!this.currentTileX || this.currentTileY === undefined) {
      const listContainer = container.querySelector("#wps-snapshots-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">${t`${"location_unavailable"}`}</div>`;
      }
      return;
    }

    try {
      const snapshots = await TimeTravelStorage.getSnapshotsForTile(
        this.currentTileX,
        this.currentTileY
      );
      const listContainer = container.querySelector("#wps-snapshots-list");

      if (listContainer) {
        if (snapshots.length === 0) {
          listContainer.innerHTML = `<div class="text-sm text-gray-500 text-center p-4">${t`${"no_items"}`}</div>`;
        } else {
          listContainer.innerHTML = snapshots
            .map((snapshot) => this.renderSnapshotItem(snapshot))
            .join("");
        }
      }
    } catch (error) {
      console.error("Failed to load snapshots:", error);
      const listContainer = container.querySelector("#wps-snapshots-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">Failed to load snapshots</div>`;
      }
    }
  }

  private calculateTileCoords(
    lat: number,
    lng: number
  ): { TLX: number; TLY: number } {
    const tileSize = 1000;
    const zoom = 11;
    const scale = tileSize * Math.pow(2, zoom);

    const worldX = ((lng + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const worldY =
      (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;

    return {
      TLX: Math.floor(worldX / tileSize),
      TLY: Math.floor(worldY / tileSize),
    };
  }

  private async saveCurrentSnapshot(container: HTMLElement): Promise<void> {
    if (!this.currentTileX || this.currentTileY === undefined) return;

    const tileSnapshot = (window as any).wplaceStudio?.tileSnapshot;
    if (tileSnapshot) {
      try {
        const snapshotId = await tileSnapshot.saveSnapshot(
          this.currentTileX,
          this.currentTileY
        );
        this.showToast(`Snapshot saved: ${snapshotId}`);
        await this.reloadSnapshots(container);
      } catch (error) {
        this.showToast(`Save failed: ${error}`);
      }
    }
  }
}
