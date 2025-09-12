import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, SnapshotInfo } from "../storage";
import { t } from "../../../i18n/manager";
import { I18nManager } from "../../../i18n/manager";

export abstract class BaseSnapshotRoute {
  protected setupSnapshotEvents(container: HTMLElement, listSelector: string): void {
    container
      .querySelector(listSelector)
      ?.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const deleteBtn = target.closest(".wps-delete-btn") as HTMLElement | null;
        const drawBtn = target.closest(".wps-draw-btn") as HTMLElement | null;
        const downloadBtn = target.closest(".wps-download-btn") as HTMLElement | null;

        if (deleteBtn?.dataset.snapshotKey) {
          await this.deleteSnapshot(deleteBtn.dataset.snapshotKey, container);
        } else if (drawBtn?.dataset.snapshotKey) {
          await this.drawSnapshot(drawBtn.dataset.snapshotKey);
        } else if (downloadBtn?.dataset.snapshotKey) {
          await this.openDownloadModal(downloadBtn.dataset.snapshotKey);
        }
      });
  }

  protected renderSnapshotItem(snapshot: SnapshotInfo): string {
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
            <button class="btn btn-sm btn-primary wps-draw-btn" data-snapshot-key="${snapshot.fullKey}">
              ${t`${"draw_image"}`}
            </button>
            <button class="btn btn-sm btn-neutral wps-download-btn" data-snapshot-key="${snapshot.fullKey}">
              ${t`${"download"}`}
            </button>
            <button class="btn btn-sm btn-error wps-delete-btn" data-snapshot-key="${snapshot.fullKey}">
              ${t`${"delete"}`}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  protected async deleteSnapshot(fullKey: string, container: HTMLElement): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;
    await TimeTravelStorage.removeSnapshotFromIndex(fullKey);
    this.showToast(t`${"deleted_message"}`);
    await this.reloadSnapshots(container);
  }

  protected async drawSnapshot(fullKey: string): Promise<void> {
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

  protected async openDownloadModal(fullKey: string): Promise<void> {
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

      const img = document.getElementById("wps-snapshot-image") as HTMLImageElement;
      if (img) {
        img.src = dataUrl;
      }

      const modal = document.getElementById("wplace-studio-snapshot-download-modal") as HTMLDialogElement;
      modal?.showModal();
    } catch (error) {
      this.showToast(`Open failed: ${error}`);
    }
  }

  protected showToast(message: string): void {
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

  protected abstract reloadSnapshots(container: HTMLElement): Promise<void>;
}
