import { BaseSnapshotRoute } from "./base-snapshot-route";
import { Toast } from "@/components/toast";
import { TimeTravelRouter } from "../router";
import { getCurrentPosition, gotoPosition } from "@/utils/position";
import { TimeTravelStorage } from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "@/i18n/manager";
import { showNameInputModal } from "@/components/modal";
import { latLngToTilePixel, tilePixelToLatLng } from "@/utils/coordinate";
import { Tutorial } from "@/features/tutorial";
import { runtime } from "@/utils/browser-api";
import { normalizeTileCoordinate } from "../utils/tile-coordinate";
import { showFeatureHint } from "@/features/feature-hints";
import { isTabletOrBelowViewport } from "@/constants/breakpoints";
import {
  getOriginalTileDataUrl,
  getSnapshotDataUrl,
} from "@/utils/inject-bridge";

interface SnapshotRouteOptions {
  showSaveButton: boolean;
}

export class SnapshotRoute extends BaseSnapshotRoute {
  private options: SnapshotRouteOptions;
  private currentTileX?: number;
  private currentTileY?: number;
  private tutorial: Tutorial;
  private router?: TimeTravelRouter;
  private isMobile = false;

  constructor(options: SnapshotRouteOptions) {
    super();
    this.options = options;
    this.tutorial = new Tutorial();
  }

  private async editTileName(): Promise<void> {
    if (this.currentTileX === undefined || this.currentTileY === undefined)
      return;

    const newName = await showNameInputModal(
      t`${"edit"}`,
      t`${"enter_tile_name"}`,
    );

    if (newName === null) return;

    await TileNameStorage.setTileName(
      this.currentTileX,
      this.currentTileY,
      newName,
    );
    await this.updateTileInfo();
    Toast.success("Tile name updated");
  }

  private async updateTileInfo(): Promise<void> {
    const nameDisplay = document.getElementById("tile-name-display");
    const coordinateInfo = document.getElementById("tile-coordinate-info");
    const editBtn = document.getElementById("edit-tile-name-btn");
    const gotoBtn = document.getElementById("goto-tile-btn");

    if (this.currentTileX === undefined || this.currentTileY === undefined) {
      nameDisplay && (nameDisplay.textContent = "Location unavailable");
      coordinateInfo && (coordinateInfo.textContent = "(-,-)");
      editBtn && editBtn.setAttribute("disabled", "true");
      gotoBtn && gotoBtn.setAttribute("disabled", "true");
      return;
    }

    const tileName = await TileNameStorage.getTileName(
      this.currentTileX,
      this.currentTileY,
    );
    const displayName =
      tileName || `Tile(${this.currentTileX}, ${this.currentTileY})`;

    nameDisplay && (nameDisplay.textContent = displayName);
    coordinateInfo &&
      (coordinateInfo.textContent = `${this.currentTileX}, ${this.currentTileY}`);
    editBtn && editBtn.removeAttribute("disabled");
    gotoBtn && gotoBtn.removeAttribute("disabled");
  }

  private renderSaveButton(): string {
    return `
      <div style="margin-top: 8px; display: flex; gap: 8px;">
        <button id="wps-save-current-snapshot-btn" class="btn btn-sm btn-primary" style="flex: 1;">
          ${t`${"save_current_snapshot"}`}
        </button>
        <button id="wps-open-tmp-tile-board-btn" class="btn btn-sm btn-outline" style="padding: 8px;" title="Open tmp tile board">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
            <path fill-rule="evenodd" d="M3 4.5A1.5 1.5 0 014.5 3h2.379a1.5 1.5 0 011.06.44l.621.621a1.5 1.5 0 001.06.439H19.5A1.5 1.5 0 0121 6v1.5a.75.75 0 01-1.5 0V6H9.621a3 3 0 01-2.121-.879l-.621-.621H4.5V18h5.25a.75.75 0 010 1.5H4.5A1.5 1.5 0 013 18V4.5z" clip-rule="evenodd" />
            <path fill-rule="evenodd" d="M15.75 10.5a.75.75 0 011.5 0v4.19l1.72-1.72a.75.75 0 111.06 1.06l-3 3a.75.75 0 01-1.06 0l-3-3a.75.75 0 111.06-1.06l1.72 1.72V10.5z" clip-rule="evenodd" />
            <path d="M12 19.5a.75.75 0 000 1.5h9a.75.75 0 000-1.5h-9z" />
          </svg>
        </button>
        <button id="wps-download-current-tile-btn" class="btn btn-sm btn-outline" style="padding: 8px;" title="Download current tile image" disabled>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
            <path fill-rule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    `;
  }

  render(container: HTMLElement, router: TimeTravelRouter): void {
    this.router = router;
    this.isMobile = isTabletOrBelowViewport();
    const currentRoute = router.getCurrentRoute();
    const selectedTile = (router as any).selectedTile;
    const importButtonText = this.isMobile ? "" : t`${"import"}`;

    // current-positionルートでは必ず現在位置を使用
    if (currentRoute === "current-position" || !selectedTile) {
      const position = getCurrentPosition();
      if (position) {
        const coords = latLngToTilePixel(position.lat, position.lng);
        const normalized = normalizeTileCoordinate(coords.TLX, coords.TLY);
        this.currentTileX = normalized.tileX;
        this.currentTileY = normalized.tileY;
      } else {
        this.currentTileX = undefined;
        this.currentTileY = undefined;
      }
    } else {
      const normalized = normalizeTileCoordinate(
        selectedTile.tileX,
        selectedTile.tileY,
      );
      this.currentTileX = normalized.tileX;
      this.currentTileY = normalized.tileY;
    }

    container.innerHTML = `
      <!-- タイル名称管理UI + Import Button -->
      <div class="mb-4 p-3 border rounded bg-gray-50" style="display: flex; align-items: center; gap: 12px;">
        <div id="tile-info-section" style="flex: 1; display: flex; align-items: center; gap: 8px;">
          <div style="flex: 1; display: flex; align-items: center; gap: 6px;">
            <div id="tile-name-display" class="font-bold text-xs">Loading...</div>
            <button id="edit-tile-name-btn" class="btn btn-sm btn-ghost" style="padding: 4px; min-height: auto; height: auto;" title="Edit tile name">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
                <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z" />
                <path d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z" />
              </svg>
            </button>
          </div>
          <button id="goto-tile-btn" class="btn btn-xs btn-ghost" style="display: flex; align-items: center; gap: 4px; padding: 4px 8px;" title="Go to location">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" />
            </svg>
            <span id="tile-coordinate-info" style="font-size: 10px;">Tile(-,-)</span>
          </button>
        </div>

        <!-- Import Button -->
        <button id="wps-import-snapshot-btn" class="btn btn-xs btn-neutral" style="flex-shrink: 0;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path fill-rule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clip-rule="evenodd" />
          </svg>
          ${importButtonText}
        </button>
      </div>

      <!-- レスポンシブレイアウト -->
      <style>
        .snapshot-layout {
          display: flex;
          gap: 12px;
          height: calc(80vh - 180px);
        }
        .snapshot-list-container {
          flex: 3;
          overflow-y: auto;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
        }
        .current-tile-container {
          flex: 2;
          display: flex;
          flex-direction: column;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          padding: 8px;
        }
        @media (max-width: 768px) {
          .snapshot-layout {
            flex-direction: column;
            height: auto;
          }
          .current-tile-container {
            flex: none;
            min-height: 300px;
            order: -1;
          }
          .snapshot-list-container {
            flex: none;
            min-height: 400px;
            overflow-y: visible;
          }
        }
      </style>
      <div class="snapshot-layout">
        <!-- スナップショット一覧 -->
        <div class="snapshot-list-container">
          <div id="wps-snapshots-list">
            <div class="text-sm text-gray-500 text-center p-4">${t`${"loading"}`}</div>
          </div>
        </div>

        <!-- 現在タイル画像 + 保存ボタン（モバイルでは上に表示） -->
        <div class="current-tile-container">
          <div id="current-tile-image-container" style="flex: 1; position: relative; display: flex; align-items: center; justify-content: center; background-color: #f9fafb; min-height: 0;">
            <canvas id="wps-current-tile-canvas" style="max-width: 100%; max-height: 100%; object-fit: contain;"></canvas>
            <div id="no-image-message" style="display: none; position: absolute; inset: 12px;"></div>
          </div>
          ${this.options.showSaveButton ? this.renderSaveButton() : ""}
        </div>
      </div>
    `;

    this.setupEvents(container);
    this.updateTileInfo(); // タイル情報更新
    this.reloadSnapshots(container);
    this.loadCurrentTileImage(); // 現在タイル画像読み込み
    this.tutorial.createButton(container);
  }

  private setupEvents(container: HTMLElement): void {
    // インポートボタンのイベント
    container
      .querySelector("#wps-import-snapshot-btn")
      ?.addEventListener("click", () => {
        this.router?.navigate("import-snapshot");
      });

    // 保存ボタンのイベント
    if (this.options.showSaveButton) {
      const saveBtn = container.querySelector("#wps-save-current-snapshot-btn");
      saveBtn?.addEventListener("click", async () => {
        await this.saveCurrentSnapshot(container);
      });

      if (saveBtn instanceof HTMLElement) {
        showFeatureHint("save-current-snapshot-btn", saveBtn);
      }

      // ダウンロードボタンのイベント
      container
        .querySelector("#wps-open-tmp-tile-board-btn")
        ?.addEventListener("click", () => {
          this.router?.navigate("tmp-tile-board");
        });

      container
        .querySelector("#wps-download-current-tile-btn")
        ?.addEventListener("click", async () => {
          await this.downloadCurrentTile();
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
    if (this.currentTileX === undefined || this.currentTileY === undefined) {
      const listContainer = container.querySelector("#wps-snapshots-list");
      if (listContainer) {
        listContainer.innerHTML = `<div class="text-sm text-red-500 text-center p-4">${t`${"location_unavailable"}`}</div>`;
      }
      return;
    }

    const snapshots = await TimeTravelStorage.getSnapshotsForTile(
      this.currentTileX,
      this.currentTileY,
    );
    const listContainer = container.querySelector(
      "#wps-snapshots-list",
    ) as HTMLElement;

    if (listContainer) {
      if (snapshots.length === 0) {
        this.renderEmptySnapshotState(listContainer);
      } else {
        const renderedItems = await Promise.all(
          snapshots.map((snapshot) => this.renderSnapshotItem(snapshot)),
        );
        listContainer.innerHTML = renderedItems.join("");
      }
    }
  }

  private renderEmptySnapshotState(listContainer: HTMLElement): void {
    const tutorialGifUrl = runtime.getURL(
      "assets/images/tutorial/how_to_archive.gif",
    );

    listContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; gap: 1.5rem;">
        <img src="${tutorialGifUrl}" alt="How to archive" style="width: 16rem; height: auto; border-radius: 0.75rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">

        <div style="text-align: center; max-width: 350px;">
          <p style="font-size: 0.95rem; color: #6b7280;">${t`${"empty_archive_message"}`}</p>
        </div>
      </div>
    `;
  }

  private async saveCurrentSnapshot(container: HTMLElement): Promise<void> {
    if (this.currentTileX === undefined || this.currentTileY === undefined)
      return;

    const tileSnapshot = window.mrWplace?.tileSnapshot;
    if (!tileSnapshot) {
      this.setNoImageState("Tile snapshot is not ready");
      Toast.error("Tile snapshot is not available");
      return;
    }

    const name = await showNameInputModal(
      t`${"save_current_snapshot"}`,
      t`${"enter_snapshot_name"}`,
    );
    if (name === null) return;

    try {
      const tmpReady = await this.ensureTmpTileAvailable();
      if (!tmpReady) {
        this.setNoImageState(
          "No tile image available",
          "Move map slightly or wait for refresh, then try again.",
        );
        Toast.error("Tile image is not available yet");
        return;
      }

      const snapshotId = await tileSnapshot.saveSnapshot(
        this.currentTileX,
        this.currentTileY,
        name === "" ? undefined : name,
      );

      Toast.success(`Snapshot saved: ${snapshotId}`);
      await Promise.all([
        this.reloadSnapshots(container),
        this.loadCurrentTileImage(),
      ]);
    } catch (error) {
      console.error("🧑‍🎨 : Failed to save current snapshot:", error);
      Toast.error("Failed to save snapshot");
    }
  }

  private async gotoTilePosition(): Promise<void> {
    if (this.currentTileX === undefined || this.currentTileY === undefined)
      return;

    const { lat, lng } = tilePixelToLatLng(
      this.currentTileX,
      this.currentTileY,
    );
    await gotoPosition({ lat, lng, zoom: 11 });
  }

  private async downloadCurrentTile(): Promise<void> {
    if (this.currentTileX === undefined || this.currentTileY === undefined) {
      Toast.error("Location unavailable");
      return;
    }

    let canvas = document.getElementById(
      "wps-current-tile-canvas",
    ) as HTMLCanvasElement | null;

    if (!canvas || canvas.style.display === "none") {
      await this.loadCurrentTileImage();
      canvas = document.getElementById(
        "wps-current-tile-canvas",
      ) as HTMLCanvasElement | null;
    }

    if (!canvas || canvas.style.display === "none") {
      Toast.error("Tile image not loaded");
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        Toast.error("Failed to create image");
        return;
      }

      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/T/, "_")
        .replace(/\..+/, "")
        .replace(/:/g, "-");
      const filename = `tile_${this.currentTileX}_${this.currentTileY}_${timestamp}.png`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      Toast.success("Tile image downloaded");
    }, "image/png");
  }

  private async loadCurrentTileImage(): Promise<void> {
    this.setNoImageState("Loading tile image...");

    if (this.currentTileX === undefined || this.currentTileY === undefined) {
      this.setNoImageState(t`${"location_unavailable"}`);
      return;
    }

    const tileSnapshot = window.mrWplace?.tileSnapshot;
    if (!tileSnapshot) {
      this.setNoImageState("Tile snapshot is not ready");
      return;
    }

    try {
      const preview = await this.resolveCurrentTileDataUrl();

      if (!preview.dataUrl) {
        this.setNoImageState(
          "No tile image available",
          "Move map slightly or wait for refresh, then save.",
        );
        return;
      }

      if (preview.source === "original") {
        const fetchedBlob = await this.dataUrlToBlob(preview.dataUrl);
        await tileSnapshot.saveTmpTile(
          this.currentTileX,
          this.currentTileY,
          fetchedBlob,
        );
      }

      await this.drawCurrentTileOnCanvas(preview.dataUrl);
    } catch (error) {
      console.error("🧑‍🎨 : Failed to load current tile image:", error);
      this.setNoImageState("Failed to load tile image");
    }
  }

  private setDownloadButtonEnabled(enabled: boolean): void {
    const downloadBtn = document.getElementById(
      "wps-download-current-tile-btn",
    ) as HTMLButtonElement | null;
    if (!downloadBtn) return;
    downloadBtn.disabled = !enabled;
  }

  private setNoImageState(primary: string, secondary?: string): void {
    const canvas = document.getElementById(
      "wps-current-tile-canvas",
    ) as HTMLCanvasElement | null;
    const noImageMessage = document.getElementById(
      "no-image-message",
    ) as HTMLDivElement | null;

    if (!canvas || !noImageMessage) return;

    canvas.style.display = "none";
    noImageMessage.innerHTML = `
      <div style="height: 100%; min-height: 180px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 8px; padding: 12px; border: 1px dashed #d1d5db; border-radius: 8px; background: #ffffff; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#9ca3af" style="width: 28px; height: 28px;">
          <path fill-rule="evenodd" d="M1.5 6A2.25 2.25 0 013.75 3.75h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zm2.25-.75A.75.75 0 003 6v12c0 .414.336.75.75.75h16.5A.75.75 0 0021 18V6a.75.75 0 00-.75-.75H3.75z" clip-rule="evenodd" />
          <path d="M7.53 8.47a.75.75 0 011.06 0l2.16 2.16 3.66-3.66a.75.75 0 011.06 1.06l-4.19 4.19a.75.75 0 01-1.06 0L7.53 9.53a.75.75 0 010-1.06z" />
          <path d="M6 16.5a.75.75 0 000 1.5h12a.75.75 0 000-1.5H6z" />
        </svg>
        <div style="font-size: 0.875rem; color: #4b5563; font-weight: 600;">${primary}</div>
        ${
          secondary
            ? `<div style="font-size: 0.75rem; color: #6b7280;">${secondary}</div>`
            : ""
        }
      </div>
    `;
    noImageMessage.style.display = "block";
    this.setDownloadButtonEnabled(false);
  }

  private async drawCurrentTileOnCanvas(dataUrl: string): Promise<void> {
    const canvas = document.getElementById(
      "wps-current-tile-canvas",
    ) as HTMLCanvasElement | null;
    const noImageMessage = document.getElementById("no-image-message");
    if (!canvas || !noImageMessage) return;

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.drawImage(img, 0, 0);
        canvas.style.display = "block";
        noImageMessage.style.display = "none";
        this.setDownloadButtonEnabled(true);
        resolve();
      };
      img.onerror = () => {
        this.setNoImageState("Failed to render tile image");
        resolve();
      };
      img.src = dataUrl;
    });
  }

  private async resolveCurrentTileDataUrl(): Promise<{
    dataUrl: string | null;
    source: "tmp" | "snapshot" | "original" | "none";
  }> {
    if (this.currentTileX === undefined || this.currentTileY === undefined)
      return { dataUrl: null, source: "none" };

    const tileSnapshot = window.mrWplace?.tileSnapshot;

    if (tileSnapshot) {
      const tmpBlob = await tileSnapshot.getTmpTile(
        this.currentTileX,
        this.currentTileY,
      );
      if (tmpBlob) {
        return {
          dataUrl: await this.blobToDataUrl(tmpBlob),
          source: "tmp",
        };
      }
    }

    const snapshots = await TimeTravelStorage.getSnapshotsForTile(
      this.currentTileX,
      this.currentTileY,
    );
    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[0];
      const snapshotId = latestSnapshot.fullKey.replace("tile_snapshot_", "");
      const snapshotDataUrl = await getSnapshotDataUrl(snapshotId);
      if (snapshotDataUrl) {
        return { dataUrl: snapshotDataUrl, source: "snapshot" };
      }
    }

    const originalTileDataUrl = await getOriginalTileDataUrl(
      this.currentTileX,
      this.currentTileY,
    );
    if (originalTileDataUrl) {
      return { dataUrl: originalTileDataUrl, source: "original" };
    }

    return { dataUrl: null, source: "none" };
  }

  private async ensureTmpTileAvailable(): Promise<boolean> {
    if (this.currentTileX === undefined || this.currentTileY === undefined)
      return false;

    const tileSnapshot = window.mrWplace?.tileSnapshot;
    if (!tileSnapshot) return false;

    const existingTmpBlob = await tileSnapshot.getTmpTile(
      this.currentTileX,
      this.currentTileY,
    );
    if (existingTmpBlob) return true;

    const canvas = document.getElementById(
      "wps-current-tile-canvas",
    ) as HTMLCanvasElement | null;
    const canvasBlob = await new Promise<Blob | null>((resolve) => {
      if (!canvas || canvas.style.display === "none") {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });

    if (canvasBlob) {
      await tileSnapshot.saveTmpTile(
        this.currentTileX,
        this.currentTileY,
        canvasBlob,
      );
      return true;
    }

    const originalTileDataUrl = await getOriginalTileDataUrl(
      this.currentTileX,
      this.currentTileY,
    );
    if (!originalTileDataUrl) return false;

    const blob = await this.dataUrlToBlob(originalTileDataUrl);
    await tileSnapshot.saveTmpTile(this.currentTileX, this.currentTileY, blob);
    return true;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async dataUrlToBlob(dataUrl: string): Promise<Blob> {
    const response = await fetch(dataUrl);
    return response.blob();
  }
}
