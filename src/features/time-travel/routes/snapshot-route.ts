import { BaseSnapshotRoute } from "./base-snapshot-route";
import { Toast } from "../../../components/toast";
import { TimeTravelRouter } from "../router";
import { getCurrentPosition, gotoPosition } from "../../../utils/position";
import { TimeTravelStorage } from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "../../../i18n/manager";
import { showNameInputModal } from "../../../utils/modal";
import { llzToTilePixel, tilePixelToLatLng } from "../../../utils/coordinate";

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

  private async editTileName(): Promise<void> {
    if (!this.currentTileX || this.currentTileY === undefined) return;

    const newName = await showNameInputModal(
      t`${"edit"}`,
      t`${"enter_tile_name"}`
    );

    if (newName === null) return;

    await TileNameStorage.setTileName(
      this.currentTileX,
      this.currentTileY,
      newName
    );
    await this.updateTileInfo();
    Toast.success("Tile name updated");
  }

  private async updateTileInfo(): Promise<void> {
    const nameDisplay = document.getElementById("tile-name-display");
    const coordinateInfo = document.getElementById("tile-coordinate-info");
    const editBtn = document.getElementById("edit-tile-name-btn");
    const gotoBtn = document.getElementById("goto-tile-btn");

    if (!this.currentTileX || this.currentTileY === undefined) {
      nameDisplay && (nameDisplay.textContent = "Location unavailable");
      coordinateInfo && (coordinateInfo.textContent = "Tile(-,-)");
      editBtn && editBtn.setAttribute("disabled", "true");
      gotoBtn && gotoBtn.setAttribute("disabled", "true");
      return;
    }

    const tileName = await TileNameStorage.getTileName(
      this.currentTileX,
      this.currentTileY
    );
    const displayName =
      tileName || `Tile(${this.currentTileX}, ${this.currentTileY})`;

    nameDisplay && (nameDisplay.textContent = displayName);
    coordinateInfo &&
      (coordinateInfo.textContent = `Tile(${this.currentTileX}, ${this.currentTileY})`);
    editBtn && editBtn.removeAttribute("disabled");
    gotoBtn && gotoBtn.removeAttribute("disabled");
  }

  private renderSaveButton(): string {
    return `
      <div class="mb-4">
        <button id="wps-save-current-snapshot-btn" class="btn btn-primary w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
            <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
          </svg>
          ${t`${"save_current_snapshot"}`}
        </button>
      </div>
    `;
  }

  render(container: HTMLElement, router: TimeTravelRouter): void {
    const selectedTile = (router as any).selectedTile;

    // タイル情報を毎回最新取得（位置変更対応）
    if (selectedTile) {
      this.currentTileX = selectedTile.tileX;
      this.currentTileY = selectedTile.tileY;
    } else {
      const position = getCurrentPosition();
      if (position) {
        const coords = llzToTilePixel(position.lat, position.lng);
        this.currentTileX = coords.TLX;
        this.currentTileY = coords.TLY;
      } else {
        this.currentTileX = undefined;
        this.currentTileY = undefined;
      }
    }

    container.innerHTML = `
      <!-- タイル名称管理UI -->
      <div class="mb-4 p-3 border rounded bg-gray-50">
        <div id="tile-info-section" class="flex items-center gap-3">
          <div class="flex-1">
            <div id="tile-name-display" class="font-bold text-base">Loading...</div>
          </div>
          <button id="edit-tile-name-btn" class="btn btn-sm btn-outline" title="Edit tile name">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
              <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
            </svg>
            Edit
          </button>
          <div id="tile-coordinate-info" class="text-sm text-gray-600">Tile(-,-)</div>
          <button id="goto-tile-btn" class="btn btn-sm btn-ghost" title="Go to location">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div class="max-h-60 overflow-y-auto border rounded p-2">
        <div id="wps-snapshots-list">
          <div class="text-sm text-gray-500 text-center p-4">${t`${"loading"}`}</div>
        </div>
      </div>
      ${this.options.showSaveButton ? this.renderSaveButton() : ""}
    `;

    this.setupEvents(container);
    this.updateTileInfo(); // タイル情報更新
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

    // Edit名前ボタンのイベント
    container
      .querySelector("#edit-tile-name-btn")
      ?.addEventListener("click", async () => {
        await this.editTileName();
      });

    // 位置移動ボタンのイベント
    container.querySelector("#goto-tile-btn")?.addEventListener("click", () => {
      this.gotoTilePosition();
    });

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
  }

  private async saveCurrentSnapshot(container: HTMLElement): Promise<void> {
    if (!this.currentTileX || this.currentTileY === undefined) return;

    // 名称入力Modal表示
    const name = await showNameInputModal(
      t`${"save_current_snapshot"}`,
      t`${"enter_snapshot_name"}`
    );

    // キャンセルされた場合は処理中断
    if (name === null) return;

    const tileSnapshot = (window as any).wplaceStudio?.tileSnapshot;
    if (!tileSnapshot) throw new Error("TileSnapshot not found");
    const snapshotId = await tileSnapshot.saveSnapshot(
      this.currentTileX,
      this.currentTileY,
      name === "" ? undefined : name
    );
    Toast.success(`Snapshot saved: ${snapshotId}`);
    await this.reloadSnapshots(container);
  }

  private gotoTilePosition(): void {
    if (this.currentTileX === undefined || this.currentTileY === undefined)
      return;

    const { lat, lng } = tilePixelToLatLng(
      this.currentTileX,
      this.currentTileY
    );
    gotoPosition({ lat, lng, zoom: 11 });
  }
}
