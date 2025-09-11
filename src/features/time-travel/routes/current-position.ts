import { TimeTravelRouter } from "../router";
import { getCurrentPosition } from "../../../utils/position";
import { TimeTravelStorage, SnapshotInfo } from "../storage";
import { t } from "../../../i18n/manager";
import { I18nManager } from "../../../i18n/manager";

export class CurrentPositionRoute {
  render(container: HTMLElement, router: TimeTravelRouter): void {
    container.innerHTML = t`
      <!-- スナップショット一覧 -->
      <div class="max-h-60 overflow-y-auto border rounded p-2 mb-4">
        <div id="wps-current-snapshots-list">
          <div class="text-sm text-gray-500 text-center p-4">${"loading"}</div>
        </div>
      </div>
      
      <!-- アクションボタン -->
      <div class="flex gap-2">
        <button id="wps-save-current-snapshot-btn" class="btn btn-primary flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
            <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
          </svg>
          ${"save_current_snapshot"}
        </button>
        <button id="wps-browse-all-tiles-btn" class="btn btn-neutral">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path fill-rule="evenodd" d="M1.5 5.625c0-1.036.84-1.875 1.875-1.875h17.25c1.035 0 1.875.84 1.875 1.875v12.75c0 1.035-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 011.5 18.375V5.625zM21 9.375A.375.375 0 0020.625 9h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zm0 3.75a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zm0 3.75a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5zM10.875 18.75a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5zM3.375 15.375a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5zm0-3.75a.375.375 0 00-.375.375v1.5c0 .207.168.375.375.375h7.5a.375.375 0 00.375-.375v-1.5a.375.375 0 00-.375-.375h-7.5z" clip-rule="evenodd" />
          </svg>
          ${"browse_all_tiles"}
        </button>
      </div>
    `;

    this.setupEvents(container, router);
    this.loadCurrentSnapshots(container);
  }

  private setupEvents(container: HTMLElement, router: TimeTravelRouter): void {
    // 保存ボタン
    container
      .querySelector("#wps-save-current-snapshot-btn")
      ?.addEventListener("click", async () => {
        await this.saveCurrentSnapshot(container);
      });

    // 全タイル参照ボタン
    container
      .querySelector("#wps-browse-all-tiles-btn")
      ?.addEventListener("click", () => {
        router.navigate("tile-list");
      });

    // スナップショット一覧のイベント委譲（既存コード流用）
    container
      .querySelector("#wps-current-snapshots-list")
      ?.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const deleteBtn = target.closest(
          ".wps-delete-btn"
        ) as HTMLElement | null;
        const drawBtn = target.closest(".wps-draw-btn") as HTMLElement | null;
        const downloadBtn = target.closest(
          ".wps-download-btn"
        ) as HTMLElement | null;

        if (deleteBtn?.dataset.snapshotKey) {
          await this.deleteSnapshot(deleteBtn.dataset.snapshotKey, container);
        } else if (drawBtn?.dataset.snapshotKey) {
          await this.drawSnapshot(drawBtn.dataset.snapshotKey);
        } else if (downloadBtn?.dataset.snapshotKey) {
          await this.openDownloadModal(downloadBtn.dataset.snapshotKey);
        }
      });
  }

  private async loadCurrentSnapshots(container: HTMLElement): Promise<void> {
    const position = getCurrentPosition();
    if (!position) {
      const listContainer = container.querySelector(
        "#wps-current-snapshots-list"
      );
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">${t`${"location_unavailable"}`}</div>`;
      }
      return;
    }

    const { TLX, TLY } = this.calculateTileCoords(position.lat, position.lng);
    const snapshots = await TimeTravelStorage.getSnapshotsForTile(TLX, TLY);

    const listContainer = container.querySelector(
      "#wps-current-snapshots-list"
    );
    if (listContainer) {
      listContainer.innerHTML =
        snapshots.length === 0
          ? `<div class="text-sm text-gray-500 text-center p-4">${t`${"no_items"}`}</div>`
          : snapshots
              .map((snapshot) => this.renderSnapshotItem(snapshot))
              .join("");
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

  private renderSnapshotItem(snapshot: SnapshotInfo): string {
    const locale = I18nManager.getCurrentLocale();
    const localeString = locale === "ja" ? "ja-JP" : "en-US";
    const timeFormat = {
      year: "numeric" as const,
      month: "2-digit" as const,
      day: "2-digit" as const,
      hour: "2-digit" as const,
      minute: "2-digit" as const,
    };
    const formattedTime = new Date(snapshot.timestamp).toLocaleString(
      localeString,
      timeFormat
    );

    return `
      <div class="border-b">
        <div class="p-2 cursor-pointer hover:bg-gray-50" onclick="this.parentElement.querySelector('.details').classList.toggle('hidden')">
          <div class="text-sm font-medium">${formattedTime}</div>
          <div class="text-xs text-gray-500">${snapshot.id}</div>
        </div>
        <div class="details hidden p-2 bg-gray-50">
          <div class="flex gap-2">
            <button class="btn btn-sm btn-primary wps-draw-btn" data-snapshot-key="${
              snapshot.fullKey
            }">
              ${t`${"draw_image"}`}
            </button>
            <button class="btn btn-sm btn-neutral wps-download-btn" data-snapshot-key="${
              snapshot.fullKey
            }">
              ${t`${"download"}`}
            </button>
            <button class="btn btn-sm btn-error wps-delete-btn" data-snapshot-key="${
              snapshot.fullKey
            }">
              ${t`${"delete"}`}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private async saveCurrentSnapshot(container: HTMLElement): Promise<void> {
    const position = getCurrentPosition();
    if (!position) return;

    const { TLX, TLY } = this.calculateTileCoords(position.lat, position.lng);
    const tileSnapshot = (window as any).wplaceStudio?.tileSnapshot;

    if (tileSnapshot) {
      try {
        const snapshotId = await tileSnapshot.saveSnapshot(TLX, TLY);
        this.showToast(`Snapshot saved: ${snapshotId}`);
        this.loadCurrentSnapshots(container);
      } catch (error) {
        this.showToast(`Save failed: ${error}`);
      }
    }
  }

  private async deleteSnapshot(
    fullKey: string,
    container: HTMLElement
  ): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;
    await TimeTravelStorage.removeSnapshotFromIndex(fullKey);
    this.showToast(t`${"deleted_message"}`);
    this.loadCurrentSnapshots(container);
  }

  private async drawSnapshot(fullKey: string): Promise<void> {
    // 既存drawSnapshot実装をそのまま流用
    try {
      const result = await chrome.storage.local.get(fullKey);
      if (!result[fullKey]) {
        this.showToast("Snapshot not found");
        return;
      }

      const uint8Array = new Uint8Array(result[fullKey]);
      const blob = new Blob([uint8Array], { type: "image/png" });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const timestamp = parseInt(fullKey.split("_")[2]);
      const imageItem = {
        key: fullKey,
        dataUrl: dataUrl,
        title: `Snapshot ${fullKey.replace("tile_snapshot_", "")}`,
        createdAt: new Date(timestamp).toISOString(),
      };

      const tileX = parseInt(fullKey.split("_")[3]);
      const tileY = parseInt(fullKey.split("_")[4]);
      const coords = { TLX: tileX, TLY: tileY, PxX: 0, PxY: 0 };

      const tileOverlay = (window as any).wplaceStudio?.tileOverlay;
      if (tileOverlay) {
        await tileOverlay.drawImageWithCoords(coords, imageItem);
        this.showToast("Snapshot drawn successfully");
      } else {
        this.showToast("TileOverlay not available");
      }
    } catch (error) {
      this.showToast(`Draw failed: ${error}`);
    }
  }

  private async openDownloadModal(fullKey: string): Promise<void> {
    // 既存openDownloadModal実装をそのまま流用
    try {
      const result = await chrome.storage.local.get(fullKey);
      if (!result[fullKey]) {
        this.showToast("Snapshot not found");
        return;
      }

      const uint8Array = new Uint8Array(result[fullKey]);
      const blob = new Blob([uint8Array], { type: "image/png" });
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const img = document.getElementById(
        "wps-snapshot-image"
      ) as HTMLImageElement;
      if (img) {
        img.src = dataUrl;
      }

      const modal = document.getElementById(
        "wplace-studio-snapshot-download-modal"
      ) as HTMLDialogElement;
      modal?.showModal();
    } catch (error) {
      this.showToast(`Open failed: ${error}`);
    }
  }

  private showToast(message: string): void {
    const toast = document.createElement("div");
    toast.className = "toast toast-top toast-end z-50";
    toast.innerHTML = `
      <div class="alert alert-success">
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}
