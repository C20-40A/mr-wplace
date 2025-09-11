import { ButtonObserver, ButtonConfig } from "../../components/button-observer";
import { getCurrentPosition } from "../../utils/position";
import { CONFIG } from "../bookmark/config";
import { t } from "../../i18n/manager";
import { createTimeTravelButton, createTimeTravelModal } from "./ui";

/**
 * タイムマシン機能（Drawing流用）
 */
export class TimeTravel {
  private buttonObserver: ButtonObserver;

  constructor() {
    this.buttonObserver = new ButtonObserver();
    this.init();
  }

  private init(): void {
    const buttonConfigs: ButtonConfig[] = [
      {
        id: "timetravel-btn",
        selector: '[data-wplace-timetravel="true"]',
        containerSelector: CONFIG.selectors.positionModal,
        create: this.createTimeTravelButton.bind(this),
      },
    ];

    this.buttonObserver.startObserver(buttonConfigs);
    this.createModal();
  }

  private createTimeTravelButton(container: Element): void {
    const button = createTimeTravelButton(container);
    button.addEventListener("click", () => this.openTimeTravelModal());
    console.log("⏰ WPlace Studio: TimeTravel button added");
  }

  private openTimeTravelModal(): void {
    const position = getCurrentPosition();
    if (!position) {
      alert(t`${"location_unavailable"}`);
      return;
    }

    console.log("⏰ Opening timetravel modal at:", position);
    this.renderSnapshots(position.lat, position.lng);
    (document.getElementById("wplace-studio-timetravel-modal") as HTMLDialogElement)?.showModal();
  }

  private createModal(): void {
    const modal = createTimeTravelModal();
    
    // 保存ボタンイベント
    modal.querySelector("#wps-save-snapshot-btn")?.addEventListener("click", async () => {
      await this.saveCurrentSnapshot();
    });
  }

  private async renderSnapshots(lat: number, lng: number): Promise<void> {
    // 座標からタイル座標計算（llzToTilePixel流用）
    const { TLX, TLY } = this.calculateTileCoords(lat, lng);
    
    // 該当タイルのスナップショット一覧取得
    const snapshots = await this.getSnapshotsForTile(TLX, TLY);
    
    // 一覧表示
    const container = document.getElementById("wps-timetravel-list");
    if (container) {
      container.innerHTML = snapshots.map(snapshot => `
        <div class="p-2 border-b">
          <div class="text-sm font-medium">${snapshot.id}</div>
          <div class="text-xs text-gray-500">${new Date(snapshot.timestamp).toLocaleString()}</div>
        </div>
      `).join('');
    }
  }

  private calculateTileCoords(lat: number, lng: number): { TLX: number, TLY: number } {
    // llzToTilePixel簡易版（zoom=11, tileSize=1000固定）
    const tileSize = 1000;
    const zoom = 11;
    const scale = tileSize * Math.pow(2, zoom);
    
    const worldX = ((lng + 180) / 360) * scale;
    const sinLat = Math.sin((lat * Math.PI) / 180);
    const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
    
    return {
      TLX: Math.floor(worldX / tileSize),
      TLY: Math.floor(worldY / tileSize)
    };
  }

  private async getSnapshotsForTile(tileX: number, tileY: number): Promise<any[]> {
    const result = await chrome.storage.local.get(null);
    const snapshots = [];
    
    for (const [key, value] of Object.entries(result)) {
      if (key.startsWith('tile_snapshot_') && key.includes(`_${tileX}_${tileY}`)) {
        const timestamp = parseInt(key.split('_')[2]);
        snapshots.push({
          id: key.replace('tile_snapshot_', ''),
          timestamp,
          tileX,
          tileY
        });
      }
    }
    
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  private async saveCurrentSnapshot(): Promise<void> {
    const position = getCurrentPosition();
    if (!position) return;
    
    const { TLX, TLY } = this.calculateTileCoords(position.lat, position.lng);
    const tileSnapshot = (window as any).wplaceStudio?.tileSnapshot;
    
    if (tileSnapshot) {
      try {
        const snapshotId = await tileSnapshot.saveSnapshot(TLX, TLY);
        this.showToast(`Snapshot saved: ${snapshotId}`);
        this.renderSnapshots(position.lat, position.lng); // 一覧更新
      } catch (error) {
        this.showToast(`Save failed: ${error}`);
      }
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
