import { SnapshotInfo } from "../storage";
import { Toast } from "@/components/toast";
import { t, formatDate } from "@/i18n/manager";
import { di } from "@/core/di";
import {
  sendSnapshotsToInject,
  deleteSnapshotFromInject,
} from "@/utils/inject-bridge";

export abstract class BaseSnapshotRoute {
  protected setupSnapshotEvents(
    container: HTMLElement,
    listSelector: string
  ): void {
    container
      .querySelector(listSelector)
      ?.addEventListener("click", async (e) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        const deleteBtn = target.closest(
          ".wps-delete-btn"
        ) as HTMLElement | null;
        const drawBtn = target.closest(
          ".wps-draw-btn"
        ) as HTMLElement | null;
        const snapshotItem = target.closest(
          ".wps-snapshot-item"
        ) as HTMLElement | null;

        if (deleteBtn?.dataset.snapshotKey) {
          e.stopPropagation();
          await this.deleteSnapshot(deleteBtn.dataset.snapshotKey, container);
        } else if (drawBtn?.dataset.snapshotKey) {
          e.stopPropagation();
          await this.toggleDrawSnapshot(drawBtn.dataset.snapshotKey, container);
        } else if (snapshotItem?.dataset.snapshotKey) {
          await this.navigateToDetail(snapshotItem.dataset.snapshotKey);
        }
      });
  }

  protected async renderSnapshotItem(snapshot: SnapshotInfo): Promise<string> {
    const timeFormat = {
      year: "numeric" as const,
      month: "2-digit" as const,
      day: "2-digit" as const,
      hour: "2-digit" as const,
      minute: "2-digit" as const,
    };
    const formattedTime = formatDate(new Date(snapshot.timestamp), timeFormat);

    // スナップショット描画判定（TimeTravelStorageに移管）
    const { TimeTravelStorage } = await import("../storage");
    const isDrawing = await TimeTravelStorage.isSnapshotDrawing(
      snapshot.fullKey
    );

    return `
      <div class="border-b wps-snapshot-item" data-snapshot-key="${
        snapshot.fullKey
      }" style="position: relative; cursor: pointer;">
        <div class="p-3 pr-20">
          <div class="text-sm font-medium flex items-center gap-2">
            ${snapshot.name || formattedTime}
            ${
              isDrawing
                ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 text-green-500">
                  <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                  <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd" />
                </svg>`
                : ""
            }
          </div>
          ${
            snapshot.name
              ? `<div class="text-xs text-gray-500">${formattedTime}</div>`
              : ""
          }
        </div>
        <div class="flex gap-1" style="position: absolute; top: 12px; right: 12px;">
          <button class="wps-draw-btn border rounded p-1" data-snapshot-key="${
            snapshot.fullKey
          }" title="${isDrawing ? "Hide from map" : "Draw on map"}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 ${isDrawing ? "text-green-500" : ""}">
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
              <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clip-rule="evenodd" />
            </svg>
          </button>
          <button class="wps-delete-btn border rounded text-red-500" data-snapshot-key="${
            snapshot.fullKey
          }" style="width: 28px; height: 28px; font-size: 16px; line-height: 1;" title="Delete">×</button>
        </div>
      </div>
    `;
  }

  protected async deleteSnapshot(
    fullKey: string,
    container: HTMLElement
  ): Promise<void> {
    if (!confirm(t`${"delete_confirm"}`)) return;

    const snapshotId = fullKey.replace("tile_snapshot_", "");
    await deleteSnapshotFromInject(snapshotId);

    // Update inject side to remove snapshot overlay
    await sendSnapshotsToInject();

    Toast.success(t`${"deleted_message"}`);
    await this.reloadSnapshots(container);
  }

  protected async toggleDrawSnapshot(
    fullKey: string,
    container: HTMLElement
  ): Promise<void> {
    const { TimeTravelStorage } = await import("../storage");
    const { getSnapshotDataUrl } = await import("@/utils/inject-bridge");

    const tileX = parseInt(fullKey.split("_")[3]);
    const tileY = parseInt(fullKey.split("_")[4]);

    // 現在の状態確認
    const currentState = await TimeTravelStorage.getActiveSnapshotForTile(
      tileX,
      tileY
    );
    const willDraw = !currentState || currentState.fullKey !== fullKey;

    if (willDraw) {
      // 描画する
      const snapshotId = fullKey.replace("tile_snapshot_", "");
      const dataUrl = await getSnapshotDataUrl(snapshotId);
      if (!dataUrl) {
        Toast.error("Snapshot not found");
        return;
      }

      // Convert dataUrl to Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "snapshot.png", { type: "image/png" });

      window.postMessage({ source: "wplace-studio-drawing-start" }, "*");

      await TimeTravelStorage.drawSnapshotOnTile(tileX, tileY, file, fullKey);
      Toast.success("Snapshot drawn on map");
    } else {
      // 描画を解除
      const file = new File([], "placeholder");
      await TimeTravelStorage.drawSnapshotOnTile(tileX, tileY, file, fullKey);
      Toast.success("Snapshot removed from map");
    }

    await this.reloadSnapshots(container);
  }

  protected async navigateToDetail(fullKey: string): Promise<void> {
    const timeTravel = di.get("timeTravel");
    timeTravel.navigateToDetail(fullKey);
  }

  protected abstract reloadSnapshots(container: HTMLElement): Promise<void>;
}
