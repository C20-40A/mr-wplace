import { TimeTravelRouter } from "../router";
import { TimeTravelStorage, TileSnapshotInfo } from "../storage";
import { TileNameStorage } from "../tile-name-storage";
import { t } from "../../../i18n/manager";
import { storage } from "@/utils/browser-api";

interface TileGroup {
  id: number;
  tiles: TileSnapshotInfo[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  tileNames: string[];
}

export class TileMergeRoute {
  private allTiles: TileSnapshotInfo[] = [];
  private groups: TileGroup[] = [];
  private selectedGroup: TileGroup | null = null;
  private selectedTiles: Set<string> = new Set();
  private selectedSnapshots: Map<string, string> = new Map(); // tileKey -> snapshotFullKey

  render(container: HTMLElement, router: TimeTravelRouter): void {
    container.innerHTML = `
      <div id="wps-merge-content" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="text-sm text-gray-500 text-center p-4">${t`${"loading"}`}</div>
      </div>
    `;

    this.loadAndAnalyzeTiles(container);
  }

  private async loadAndAnalyzeTiles(container: HTMLElement): Promise<void> {
    this.allTiles = await TimeTravelStorage.getAllTilesWithSnapshots();
    
    if (this.allTiles.length === 0) {
      container.querySelector("#wps-merge-content")!.innerHTML = `
        <div class="text-sm text-gray-500 text-center p-4">${t`${"no_items"}`}</div>
      `;
      return;
    }

    this.groups = await this.findAdjacentGroups(this.allTiles);
    console.log("🧑‍🎨 : Found groups:", this.groups.length);
    
    this.renderGroupList(container);
  }

  private async findAdjacentGroups(tiles: TileSnapshotInfo[]): Promise<TileGroup[]> {
    const tileMap = new Map<string, TileSnapshotInfo>();
    for (const tile of tiles) {
      tileMap.set(`${tile.tileX}_${tile.tileY}`, tile);
    }

    const visited = new Set<string>();
    const groups: TileGroup[] = [];
    let groupId = 0;

    for (const tile of tiles) {
      const key = `${tile.tileX}_${tile.tileY}`;
      if (visited.has(key)) continue;

      const group = this.bfsGroup(tile, tileMap, visited);
      if (group.length > 1) {
        const xs = group.map(t => t.tileX);
        const ys = group.map(t => t.tileY);
        groups.push({
          id: groupId++,
          tiles: group,
          minX: Math.min(...xs),
          maxX: Math.max(...xs),
          minY: Math.min(...ys),
          maxY: Math.max(...ys),
          tileNames: [],
        });
      }
    }

    // タイル名称一括取得
    const allCoords = tiles.map(t => ({ tileX: t.tileX, tileY: t.tileY }));
    const tileNames = await TileNameStorage.getTileNames(allCoords);

    // 各グループにタイル名称を設定
    for (const group of groups) {
      const names: string[] = [];
      for (const tile of group.tiles) {
        const key = `${tile.tileX}_${tile.tileY}`;
        const name = tileNames.get(key);
        if (name) names.push(name);
      }
      group.tileNames = names;
    }

    return groups.sort((a, b) => b.tiles.length - a.tiles.length);
  }

  private bfsGroup(
    start: TileSnapshotInfo,
    tileMap: Map<string, TileSnapshotInfo>,
    visited: Set<string>
  ): TileSnapshotInfo[] {
    const group: TileSnapshotInfo[] = [];
    const queue: TileSnapshotInfo[] = [start];
    const startKey = `${start.tileX}_${start.tileY}`;
    visited.add(startKey);

    while (queue.length > 0) {
      const tile = queue.shift()!;
      group.push(tile);

      const neighbors = [
        [tile.tileX + 1, tile.tileY],
        [tile.tileX - 1, tile.tileY],
        [tile.tileX, tile.tileY + 1],
        [tile.tileX, tile.tileY - 1],
      ];

      for (const [nx, ny] of neighbors) {
        const key = `${nx}_${ny}`;
        if (!visited.has(key) && tileMap.has(key)) {
          visited.add(key);
          queue.push(tileMap.get(key)!);
        }
      }
    }

    return group;
  }

  private renderGroupList(container: HTMLElement): void {
    const content = container.querySelector("#wps-merge-content")!;
    
    content.innerHTML = `
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span class="text-sm font-bold">${t`${"merge_tiles"}`}: ${this.groups.length} groups</span>
      </div>
      <div style="overflow: auto; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.5rem; min-height: 400px;">
        <div id="wps-group-list" class="grid grid-cols-1 gap-2">
          ${this.groups.map(g => this.renderGroupCard(g)).join("")}
        </div>
      </div>
    `;

    content.querySelectorAll(".wps-group-card").forEach(card => {
      card.addEventListener("click", () => {
        const groupId = parseInt((card as HTMLElement).dataset.groupId || "0");
        this.selectGroup(groupId, container);
      });
    });
  }

  private renderGroupCard(group: TileGroup): string {
    const width = group.maxX - group.minX + 1;
    const height = group.maxY - group.minY + 1;
    const nameDisplay = group.tileNames.length > 0 ? group.tileNames.join(", ") : `(${group.minX}, ${group.minY}) - (${group.maxX}, ${group.maxY})`;
    
    return `
      <div 
        class="wps-group-card" 
        data-group-id="${group.id}"
        style="
          padding: 1rem;
          border: 2px solid #d1d5db;
          border-radius: 0.5rem;
          cursor: pointer;
          transition: all 0.2s;
          background-color: white;
        "
        onmouseover="this.style.borderColor='#3b82f6'; this.style.backgroundColor='#eff6ff';"
        onmouseout="this.style.borderColor='#d1d5db'; this.style.backgroundColor='white';"
      >
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex: 1;">
            <div style="font-weight: bold; font-size: 1rem; color: #3b82f6;">${nameDisplay}</div>
            <div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">
              ${group.tiles.length} tiles · ${width}×${height} area
            </div>
            <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">
              (${group.minX}, ${group.minY}) - (${group.maxX}, ${group.maxY})
            </div>
          </div>
          <div style="font-size: 1.5rem;">→</div>
        </div>
      </div>
    `;
  }

  private selectGroup(groupId: number, container: HTMLElement): void {
    this.selectedGroup = this.groups.find(g => g.id === groupId) || null;
    if (!this.selectedGroup) return;

    this.selectedTiles.clear();
    this.renderTileGrid(container);
  }

  private renderTileGrid(container: HTMLElement): void {
    if (!this.selectedGroup) return;

    const group = this.selectedGroup;
    const width = group.maxX - group.minX + 1;
    const height = group.maxY - group.minY + 1;

    const content = container.querySelector("#wps-merge-content")!;
    
    content.innerHTML = `
      <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
        <button id="wps-back-to-groups" class="btn btn-sm btn-neutral">${t`${"back"}`}</button>
        <button id="wps-merge-export-btn" class="btn btn-sm btn-primary">${t`${"export_png"}`}</button>
        <button id="wps-merge-clear-btn" class="btn btn-sm btn-neutral">${t`${"clear_selection"}`}</button>
        <button id="wps-select-all-btn" class="btn btn-sm btn-neutral">${t`${"enable_all"}`}</button>
        <span id="wps-selected-count" class="text-sm" style="margin-left: auto;">
          ${t`${"selected"}`}: <strong>0</strong> / ${group.tiles.length}
        </span>
      </div>
      <div style="overflow: auto; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 1rem; min-height: 500px;">
        <div id="wps-tile-grid" style="
          display: grid;
          grid-template-columns: repeat(${width}, 80px);
          gap: 4px;
          justify-content: center;
        ">
        </div>
      </div>
    `;

    const grid = content.querySelector("#wps-tile-grid")!;
    const tileMap = new Map<string, TileSnapshotInfo>();
    for (const tile of group.tiles) {
      tileMap.set(`${tile.tileX}_${tile.tileY}`, tile);
    }

    for (let y = group.minY; y <= group.maxY; y++) {
      for (let x = group.minX; x <= group.maxX; x++) {
        const key = `${x}_${y}`;
        const tile = tileMap.get(key);
        grid.innerHTML += this.renderTileCell(x, y, tile);
      }
    }

    this.setupTileGridEvents(container);
  }

  private renderTileCell(x: number, y: number, tile?: TileSnapshotInfo): string {
    const key = `${x}_${y}`;
    const hasSnapshot = !!tile;
    const isSelected = this.selectedTiles.has(key);

    const bgColor = isSelected ? "#10b981" : hasSnapshot ? "#6b7280" : "#e5e7eb";
    const cursor = hasSnapshot ? "pointer" : "default";
    const opacity = hasSnapshot ? "1" : "0.2";

    let dateTimeStr = "";
    if (tile && tile.snapshots.length > 0) {
      const date = new Date(tile.snapshots[0].timestamp);
      const datePart = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const timePart = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      dateTimeStr = `${datePart} ${timePart}`;
    }

    return `
      <div 
        class="wps-tile-cell" 
        data-tile-x="${x}" 
        data-tile-y="${y}"
        style="
          width: 80px;
          height: 80px;
          background-color: ${bgColor};
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: ${cursor};
          opacity: ${opacity};
          transition: all 0.2s;
          border: 2px solid ${isSelected ? "#065f46" : "#d1d5db"};
          font-size: 0.7rem;
          color: white;
          padding: 0.25rem;
        "
      >
        <div style="font-weight: bold;">${x},${y}</div>
        ${dateTimeStr ? `<div style="font-size: 0.5rem; margin-top: 0.125rem;">${dateTimeStr}</div>` : ""}
      </div>
    `;
  }

  private setupTileGridEvents(container: HTMLElement): void {
    container.querySelector("#wps-back-to-groups")?.addEventListener("click", () => {
      this.selectedGroup = null;
      this.selectedTiles.clear();
      this.renderGroupList(container);
    });

    container.querySelector("#wps-merge-export-btn")?.addEventListener("click", () => {
      this.exportMergedImage();
    });

    container.querySelector("#wps-merge-clear-btn")?.addEventListener("click", () => {
      this.selectedTiles.clear();
      this.updateSelectedCount(container);
      this.renderTileGrid(container);
    });

    container.querySelector("#wps-select-all-btn")?.addEventListener("click", () => {
      if (!this.selectedGroup) return;
      this.selectedTiles.clear();
      for (const tile of this.selectedGroup.tiles) {
        this.selectedTiles.add(`${tile.tileX}_${tile.tileY}`);
      }
      this.updateSelectedCount(container);
      this.renderTileGrid(container);
    });

    container.querySelectorAll(".wps-tile-cell").forEach(cell => {
      cell.addEventListener("click", () => {
        const target = cell as HTMLElement;
        const tileX = parseInt(target.dataset.tileX || "0");
        const tileY = parseInt(target.dataset.tileY || "0");
        this.toggleTileSelection(tileX, tileY, container);
      });
    });

    this.updateSelectedCount(container);
  }

  private toggleTileSelection(tileX: number, tileY: number, container: HTMLElement): void {
    if (!this.selectedGroup) return;

    const key = `${tileX}_${tileY}`;
    const tile = this.selectedGroup.tiles.find(t => t.tileX === tileX && t.tileY === tileY);

    if (!tile) return;

    if (this.selectedTiles.has(key)) {
      this.selectedTiles.delete(key);
      this.selectedSnapshots.delete(key);
    } else {
      if (tile.snapshots.length > 1) {
        this.showSnapshotSelector(tile, container);
        return;
      } else if (tile.snapshots.length === 1) {
        this.selectedTiles.add(key);
        this.selectedSnapshots.set(key, tile.snapshots[0].fullKey);
      }
    }

    this.updateSelectedCount(container);
    this.renderTileGrid(container);
  }

  private updateSelectedCount(container: HTMLElement): void {
    const countElement = container.querySelector("#wps-selected-count strong");
    if (countElement) {
      countElement.textContent = this.selectedTiles.size.toString();
    }
  }

  private showSnapshotSelector(tile: TileSnapshotInfo, container: HTMLElement): void {
    const key = `${tile.tileX}_${tile.tileY}`;
    
    const overlay = document.createElement("div");
    overlay.id = "wps-snapshot-selector-overlay";
    overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background-color: white;
      border-radius: 0.5rem;
      padding: 1.5rem;
      max-width: 400px;
      max-height: 500px;
      overflow-y: auto;
    `;

    const title = document.createElement("div");
    title.style.cssText = "font-weight: bold; font-size: 1rem; margin-bottom: 1rem;";
    title.textContent = `${t`${'select'}`} (${tile.tileX}, ${tile.tileY})`;

    const list = document.createElement("div");
    list.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem;";

    for (const snapshot of tile.snapshots) {
      const item = document.createElement("div");
      item.style.cssText = `
        padding: 0.75rem;
        border: 2px solid #d1d5db;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s;
      `;
      
      const date = new Date(snapshot.timestamp);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
      
      item.innerHTML = `
        <div style="font-weight: bold;">${dateStr} ${timeStr}</div>
        ${snapshot.name ? `<div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">${snapshot.name}</div>` : ""}
      `;

      item.addEventListener("mouseover", () => {
        item.style.borderColor = "#3b82f6";
        item.style.backgroundColor = "#eff6ff";
      });
      item.addEventListener("mouseout", () => {
        item.style.borderColor = "#d1d5db";
        item.style.backgroundColor = "white";
      });
      item.addEventListener("click", () => {
        this.selectedTiles.add(key);
        this.selectedSnapshots.set(key, snapshot.fullKey);
        container.removeChild(overlay);
        this.updateSelectedCount(container);
        this.renderTileGrid(container);
      });

      list.appendChild(item);
    }

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-sm btn-neutral";
    cancelBtn.textContent = t`${'cancel'}`;
    cancelBtn.style.cssText = "margin-top: 1rem; width: 100%;";
    cancelBtn.addEventListener("click", () => {
      container.removeChild(overlay);
    });

    card.appendChild(title);
    card.appendChild(list);
    card.appendChild(cancelBtn);
    overlay.appendChild(card);
    container.style.position = "relative";
    container.appendChild(overlay);
  }

  private async exportMergedImage(): Promise<void> {
    if (this.selectedTiles.size === 0) {
      console.log("🧑‍🎨 : No tiles selected");
      return;
    }

    if (!this.selectedGroup) return;

    const coordinates: Array<{ tileX: number; tileY: number }> = [];
    for (const key of this.selectedTiles) {
      const [tileX, tileY] = key.split("_").map(Number);
      coordinates.push({ tileX, tileY });
    }

    const minX = Math.min(...coordinates.map(c => c.tileX));
    const maxX = Math.max(...coordinates.map(c => c.tileX));
    const minY = Math.min(...coordinates.map(c => c.tileY));
    const maxY = Math.max(...coordinates.map(c => c.tileY));

    const width = (maxX - minX + 1) * 1000;
    const height = (maxY - minY + 1) * 1000;

    console.log("🧑‍🎨 : Exporting", this.selectedTiles.size, "tiles, canvas size:", width, "x", height);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("🧑‍🎨 : Failed to get canvas context");
      return;
    }

    for (const coord of coordinates) {
      const tile = this.selectedGroup.tiles.find(t => t.tileX === coord.tileX && t.tileY === coord.tileY);
      if (!tile || tile.snapshots.length === 0) continue;

      const key = `${coord.tileX}_${coord.tileY}`;
      const selectedSnapshotKey = this.selectedSnapshots.get(key);
      const snapshot = selectedSnapshotKey 
        ? tile.snapshots.find(s => s.fullKey === selectedSnapshotKey) || tile.snapshots[0]
        : tile.snapshots[0];

      const snapshotData = await storage.get([snapshot.fullKey]);
      const rawData = snapshotData[snapshot.fullKey];

      if (rawData) {
        const uint8Array = new Uint8Array(rawData);
        const blob = new Blob([uint8Array], { type: "image/png" });
        const imageBitmap = await createImageBitmap(blob);

        const x = (coord.tileX - minX) * 1000;
        const y = (coord.tileY - minY) * 1000;

        ctx.drawImage(imageBitmap, x, y, 1000, 1000);
      }
    }

    const resultBlob = await canvas.convertToBlob({ type: "image/png" });
    const url = URL.createObjectURL(resultBlob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `merged_tiles_${Date.now()}.png`;
    a.click();

    URL.revokeObjectURL(url);
    console.log("🧑‍🎨 : Merged image exported");
  }
}
