import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, SnapshotInfo } from "../storage";
import { t } from "../../../i18n/manager";
import { I18nManager } from "../../../i18n/manager";

export class TileSnapshotsRoute {
  render(container: HTMLElement, router: TimeTravelRouter): void {
    const selectedTile = (router as any).selectedTile;
    if (!selectedTile) {
      container.innerHTML = `<div class="text-sm text-red-500 text-center p-4">タイル情報が見つかりません</div>`;
      return;
    }

    container.innerHTML = t`
      <div class="mb-4">
        <div class="text-sm text-gray-600">タイル(${selectedTile.tileX}, ${
      selectedTile.tileY
    })のスナップショット</div>
      </div>
      
      <div class="max-h-60 overflow-y-auto border rounded p-2">
        <div id="wps-tile-snapshots-list">
          <div class="text-sm text-gray-500 text-center p-4">${"loading"}</div>
        </div>
      </div>
    `;

    this.setupEvents(container, router);
    this.loadTileSnapshots(container, selectedTile.tileX, selectedTile.tileY);
  }

  private setupEvents(container: HTMLElement, router: TimeTravelRouter): void {
    // スナップショット一覧のイベント委譲（current-position流用）
    container
      .querySelector("#wps-tile-snapshots-list")
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
          await this.deleteSnapshot(
            deleteBtn.dataset.snapshotKey,
            container,
            router
          );
        } else if (drawBtn?.dataset.snapshotKey) {
          await this.drawSnapshot(drawBtn.dataset.snapshotKey);
        } else if (downloadBtn?.dataset.snapshotKey) {
          await this.openDownloadModal(downloadBtn.dataset.snapshotKey);
        }
      });
  }

  private async loadTileSnapshots(
    container: HTMLElement,
    tileX: number,
    tileY: number
  ): Promise<void> {
    try {
      const snapshots = await TimeTravelStorage.getSnapshotsForTile(
        tileX,
        tileY
      );
      const listContainer = container.querySelector("#wps-tile-snapshots-list");

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
      console.error("Failed to load tile snapshots:", error);
      const listContainer = container.querySelector("#wps-tile-snapshots-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">Failed to load snapshots</div>`;
      }
    }
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

  private async deleteSnapshot(
    fullKey: string,
    container: HTMLElement,
    router: TimeTravelRouter
  ): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;
    await TimeTravelStorage.removeSnapshotFromIndex(fullKey);
    this.showToast(t`${"deleted_message"}`);

    const selectedTile = (router as any).selectedTile;
    if (selectedTile)
      this.loadTileSnapshots(container, selectedTile.tileX, selectedTile.tileY);
  }

  private async drawSnapshot(fullKey: string): Promise<void> {
    // current-position実装をそのまま流用
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
    // current-position実装をそのまま流用
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
