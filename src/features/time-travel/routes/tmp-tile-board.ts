import { t } from "@/i18n/manager";
import { getCurrentTiles } from "@/states/currentTile";
import { createCleanImageBitmap } from "@/utils/image-bitmap-compat";
import { latLngToTilePixel } from "@/utils/coordinate";
import { getCurrentPosition } from "@/utils/position";
import { TimeTravelRouter } from "../router";
import { normalizeTileCoordinate } from "../utils/tile-coordinate";

interface TmpTileEntry {
  tileX: number;
  tileY: number;
  blob: Blob;
}

interface TileBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface TileCoordinate {
  tileX: number;
  tileY: number;
}

export class TmpTileBoardRoute {
  private static readonly TILE_PREVIEW_SIZE = 96;
  private static readonly CURRENT_TILE_BORDER_COLOR = "rgb(255 215 244)";
  private static readonly NEARBY_TILE_RADIUS = 8;
  private static readonly EMPTY_POLL_INTERVAL_MS = 1500;

  private selectedTiles: Set<string> = new Set();
  private tileMap: Map<string, TmpTileEntry> = new Map();
  private bounds: TileBounds | null = null;
  private currentTile: TileCoordinate | null = null;
  private tileObjectUrls: string[] = [];
  private emptyPollTimer: number | null = null;
  private renderRequestId = 0;

  render(container: HTMLElement, _router: TimeTravelRouter): void {
    this.clearEmptyPollTimer();

    container.innerHTML = `
      <div id="wps-tmp-tile-board" style="display: flex; flex-direction: column; gap: 0.75rem; min-height: 320px; position: relative; padding-bottom: 1.25rem;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
          <div id="wps-tmp-tile-summary" class="text-sm text-base-content/70">${t`${"loading"}`}</div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <button id="wps-save-selected-tmp-tiles" class="btn btn-sm btn-primary" disabled>Save</button>
            <button id="wps-refresh-tmp-tile-board" class="btn btn-sm btn-neutral">Refresh</button>
          </div>
        </div>
        <div style="overflow: auto; justify-items: center;">
          <div id="wps-tmp-tile-grid" style="display: grid; gap: 2px; justify-items: center;"></div>
          <div id="wps-tmp-tile-empty" class="text-sm text-base-content/60 text-center p-4" style="display: none;"></div>
        </div>
        <div class="text-xs text-base-content/60" style="position: absolute; right: 0; bottom: 0; text-align: right;">${t`${"tmp_tile_board_data_notice"}`}</div>
      </div>
    `;

    this.setupEvents(container);
    this.renderBoard(container);
  }

  private setupEvents(container: HTMLElement): void {
    container
      .querySelector("#wps-refresh-tmp-tile-board")
      ?.addEventListener("click", () => {
        this.renderBoard(container);
      });

    container
      .querySelector("#wps-save-selected-tmp-tiles")
      ?.addEventListener("click", async () => {
        await this.saveSelectedTiles();
      });

    container
      .querySelector("#wps-tmp-tile-grid")
      ?.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const tileCell = target.closest(
          ".wps-tmp-tile-cell",
        ) as HTMLElement | null;
        const key = tileCell?.dataset.tileKey;
        if (!tileCell || !key) return;

        this.toggleSelection(key, tileCell, container);
      });
  }

  private async renderBoard(container: HTMLElement): Promise<void> {
    const requestId = ++this.renderRequestId;
    this.clearEmptyPollTimer();
    this.clearObjectUrls();

    const summary = container.querySelector(
      "#wps-tmp-tile-summary",
    ) as HTMLElement | null;
    const grid = container.querySelector(
      "#wps-tmp-tile-grid",
    ) as HTMLElement | null;
    const empty = container.querySelector(
      "#wps-tmp-tile-empty",
    ) as HTMLElement | null;

    if (!summary || !grid || !empty) return;

    this.setLoadingState(container, true);
    empty.style.display = "block";
    empty.innerHTML = `<div class="text-xs opacity-70">Loading nearby tiles...</div>`;
    summary.textContent = t`${"loading"}`;

    const tmpTiles = await this.collectTmpTiles();
    if (requestId !== this.renderRequestId) return;

    this.setLoadingState(container, false);
    this.tileMap = new Map(
      tmpTiles.map((tile) => [`${tile.tileX}_${tile.tileY}`, tile]),
    );
    const isCurrentTileMissing =
      !!this.currentTile &&
      !this.tileMap.has(`${this.currentTile.tileX}_${this.currentTile.tileY}`);

    if (tmpTiles.length === 0) {
      this.selectedTiles.clear();
      this.bounds = this.currentTile
        ? {
            minX: this.currentTile.tileX,
            maxX: this.currentTile.tileX,
            minY: this.currentTile.tileY,
            maxY: this.currentTile.tileY,
          }
        : null;
      this.renderTileGrid(grid);
      empty.style.display = "block";
      empty.innerHTML = `<div class="text-xs opacity-70">Waiting for nearby tile data...</div>`;
      this.updateSummary(summary);
      this.updateSaveButtonState(container);
      this.scheduleEmptyPoll(container);
      return;
    }

    const xs = tmpTiles.map((tile) => tile.tileX);
    const ys = tmpTiles.map((tile) => tile.tileY);
    if (this.currentTile) {
      xs.push(this.currentTile.tileX);
      ys.push(this.currentTile.tileY);
    }
    this.bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };

    this.selectedTiles.forEach((key) => {
      if (!this.tileMap.has(key)) this.selectedTiles.delete(key);
    });

    this.renderTileGrid(grid);
    empty.style.display = "none";
    this.updateSummary(summary);
    this.updateSaveButtonState(container);
    if (isCurrentTileMissing) this.scheduleEmptyPoll(container);
  }

  private renderTileGrid(grid: HTMLElement): void {
    if (!this.bounds) {
      grid.innerHTML = "";
      return;
    }

    const { minX, maxX, minY, maxY } = this.bounds;
    const cols = maxX - minX + 1;

    grid.style.gridTemplateColumns = `repeat(${cols}, ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px)`;
    grid.innerHTML = "";

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const key = `${x}_${y}`;
        const tile = this.tileMap.get(key);
        const isCurrentTile =
          this.currentTile?.tileX === x && this.currentTile?.tileY === y;

        if (!tile) {
          const emptyBorderColor = isCurrentTile
            ? TmpTileBoardRoute.CURRENT_TILE_BORDER_COLOR
            : "#d1d5db";
          grid.innerHTML += `
            <div style="width: ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px; height: ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px; border: 3px dashed ${emptyBorderColor}; border-radius: 6px; opacity: 0.5;"></div>
          `;
          continue;
        }

        const objectUrl = URL.createObjectURL(tile.blob);
        this.tileObjectUrls.push(objectUrl);
        const isSelected = this.selectedTiles.has(key);
        const borderColor = isSelected
          ? "var(--color-accent, #00d3bb)"
          : isCurrentTile
            ? TmpTileBoardRoute.CURRENT_TILE_BORDER_COLOR
          : "#d1d5db";

        grid.innerHTML += `
          <button class="wps-tmp-tile-cell" data-tile-key="${key}" style="width: ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px; height: ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px; border: 3px solid ${borderColor}; overflow: hidden; padding: 0; background: #fff;">
            <img src="${objectUrl}" alt="${key}" style="display: block; width: ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px; height: ${TmpTileBoardRoute.TILE_PREVIEW_SIZE}px; image-rendering: pixelated;">
            <div style="font-size: 10px; line-height: 1.2; padding: 2px 4px; text-align: center;">${x},${y}</div>
          </button>
        `;
      }
    }
  }

  private toggleSelection(
    key: string,
    tileCell: HTMLElement,
    container: HTMLElement,
  ): void {
    const [tileX, tileY] = key.split("_").map(Number);
    const isCurrentTile =
      this.currentTile?.tileX === tileX && this.currentTile?.tileY === tileY;

    if (this.selectedTiles.has(key)) {
      this.selectedTiles.delete(key);
      tileCell.style.borderColor = isCurrentTile
        ? TmpTileBoardRoute.CURRENT_TILE_BORDER_COLOR
        : "#d1d5db";
    } else {
      this.selectedTiles.add(key);
      tileCell.style.borderColor = "var(--color-accent, #00d3bb)";
    }

    const summary = container.querySelector(
      "#wps-tmp-tile-summary",
    ) as HTMLElement | null;
    if (summary) this.updateSummary(summary);
    this.updateSaveButtonState(container);
  }

  private updateSummary(summary: HTMLElement): void {
    if (!this.bounds) {
      const currentTileText = this.currentTile
        ? ` | Current: ${this.currentTile.tileX},${this.currentTile.tileY}`
        : " | Current: n/a";
      summary.textContent = `Tmp tiles: 0${currentTileText}`;
      return;
    }

    const cols = this.bounds.maxX - this.bounds.minX + 1;
    const rows = this.bounds.maxY - this.bounds.minY + 1;
    const currentTileText = this.currentTile
      ? ` | Current: ${this.currentTile.tileX},${this.currentTile.tileY}`
      : " | Current: n/a";
    summary.textContent = `Tmp tiles: ${this.tileMap.size} | ${cols}x${rows} | Selected: ${this.selectedTiles.size}${currentTileText}`;
  }

  private updateSaveButtonState(container: HTMLElement): void {
    const saveBtn = container.querySelector(
      "#wps-save-selected-tmp-tiles",
    ) as HTMLButtonElement | null;
    if (!saveBtn) return;
    saveBtn.disabled = this.selectedTiles.size === 0;
  }

  private async saveSelectedTiles(): Promise<void> {
    if (this.selectedTiles.size === 0) return;

    const selectedEntries: TmpTileEntry[] = [];
    for (const key of this.selectedTiles) {
      const tile = this.tileMap.get(key);
      if (tile) selectedEntries.push(tile);
    }

    if (selectedEntries.length === 0) return;

    const xs = selectedEntries.map((entry) => entry.tileX);
    const ys = selectedEntries.map((entry) => entry.tileY);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const firstBitmap = await createCleanImageBitmap(selectedEntries[0].blob);
    const tileWidth = firstBitmap.width;
    const tileHeight = firstBitmap.height;

    const canvas = document.createElement("canvas");
    canvas.width = (maxX - minX + 1) * tileWidth;
    canvas.height = (maxY - minY + 1) * tileHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      firstBitmap.close();
      return;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#00000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < selectedEntries.length; i++) {
      const entry = selectedEntries[i];
      const bitmap =
        i === 0 ? firstBitmap : await createCleanImageBitmap(entry.blob);

      const drawX = (entry.tileX - minX) * tileWidth;
      const drawY = (entry.tileY - minY) * tileHeight;
      ctx.drawImage(bitmap, drawX, drawY, tileWidth, tileHeight);
      bitmap.close();
    }

    const mergedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
    if (!mergedBlob) return;

    const url = URL.createObjectURL(mergedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tmp_tiles_${Date.now()}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private clearObjectUrls(): void {
    for (const url of this.tileObjectUrls) URL.revokeObjectURL(url);
    this.tileObjectUrls = [];
  }

  private setLoadingState(container: HTMLElement, isLoading: boolean): void {
    const refreshBtn = container.querySelector(
      "#wps-refresh-tmp-tile-board",
    ) as HTMLButtonElement | null;
    if (!refreshBtn) return;

    refreshBtn.disabled = isLoading;
    refreshBtn.textContent = isLoading ? "Loading..." : "Refresh";
  }

  private scheduleEmptyPoll(container: HTMLElement): void {
    this.clearEmptyPollTimer();
    this.emptyPollTimer = window.setTimeout(() => {
      if (!document.body.contains(container)) {
        this.clearEmptyPollTimer();
        return;
      }
      this.renderBoard(container);
    }, TmpTileBoardRoute.EMPTY_POLL_INTERVAL_MS);
  }

  private clearEmptyPollTimer(): void {
    if (this.emptyPollTimer === null) return;
    clearTimeout(this.emptyPollTimer);
    this.emptyPollTimer = null;
  }

  private async collectTmpTiles(): Promise<TmpTileEntry[]> {
    const tileSnapshot = window.mrWplace?.tileSnapshot;
    if (!tileSnapshot) {
      this.currentTile = null;
      return [];
    }

    const currentTiles = Array.from(getCurrentTiles());
    const previousCurrentTile = this.currentTile;
    this.currentTile = this.resolveCurrentTile(currentTiles);
    this.clearSelectionWhenCurrentTileJumps(previousCurrentTile, this.currentTile);
    const filteredTileKeys = this.filterNearbyTiles(currentTiles);
    const entries = await Promise.all(
      filteredTileKeys.map(async (key) => {
        const [tileX, tileY] = key.split(",").map(Number);
        if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;

        const blob = await tileSnapshot.getTmpTile(tileX, tileY);
        if (!blob) return null;

        return { tileX, tileY, blob } as TmpTileEntry;
      }),
    );

    return entries
      .filter((entry): entry is TmpTileEntry => entry !== null)
      .sort((a, b) => {
        if (a.tileY !== b.tileY) return a.tileY - b.tileY;
        return a.tileX - b.tileX;
      });
  }

  private pickCurrentTile(tileKeys: string[]): TileCoordinate | null {
    const latestKey = tileKeys[tileKeys.length - 1];
    if (!latestKey) return null;

    const [tileX, tileY] = latestKey.split(",").map(Number);
    if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return null;

    return { tileX, tileY };
  }

  private resolveCurrentTile(tileKeys: string[]): TileCoordinate | null {
    const position = getCurrentPosition();
    if (position) {
      const coords = latLngToTilePixel(position.lat, position.lng);
      const normalized = normalizeTileCoordinate(coords.TLX, coords.TLY);
      return { tileX: normalized.tileX, tileY: normalized.tileY };
    }

    return this.pickCurrentTile(tileKeys);
  }

  private clearSelectionWhenCurrentTileJumps(
    prev: TileCoordinate | null,
    next: TileCoordinate | null,
  ): void {
    if (!prev || !next) return;

    const jumpDistance = Math.max(
      Math.abs(prev.tileX - next.tileX),
      Math.abs(prev.tileY - next.tileY),
    );
    if (jumpDistance <= TmpTileBoardRoute.NEARBY_TILE_RADIUS * 2) return;

    this.selectedTiles.clear();
  }

  private filterNearbyTiles(tileKeys: string[]): string[] {
    if (!this.currentTile) return tileKeys;

    const { tileX: centerX, tileY: centerY } = this.currentTile;
    const radius = TmpTileBoardRoute.NEARBY_TILE_RADIUS;

    return tileKeys.filter((key) => {
      const [tileX, tileY] = key.split(",").map(Number);
      if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return false;

      return (
        Math.abs(tileX - centerX) <= radius && Math.abs(tileY - centerY) <= radius
      );
    });
  }
}
