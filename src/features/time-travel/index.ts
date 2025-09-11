import { ButtonObserver, ButtonConfig } from "../../components/button-observer";
import { getCurrentPosition } from "../../utils/position";
import { CONFIG } from "../bookmark/config";
import { t } from "../../i18n/manager";
import { I18nManager } from "../../i18n/manager";
import { createTimeTravelButton, createTimeTravelModal } from "./ui";
import { ImageItem } from "../gallery/routes/list/components";

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
    
    // スナップショット一覧のイベント委譲（bookmark流用）
    modal.querySelector("#wps-timetravel-list")?.addEventListener("click", async (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const deleteBtn = target.closest(".wps-delete-btn") as HTMLElement | null;
      const drawBtn = target.closest(".wps-draw-btn") as HTMLElement | null;
      
      if (deleteBtn?.dataset.snapshotKey) {
        this.deleteFavorite(deleteBtn.dataset.snapshotKey);
      } else if (drawBtn?.dataset.snapshotKey) {
        await this.drawSnapshot(drawBtn.dataset.snapshotKey);
      }
    });
  }

  private async renderSnapshots(lat: number, lng: number): Promise<void> {
    // 座標からタイル座標計算（llzToTilePixel流用）
    const { TLX, TLY } = this.calculateTileCoords(lat, lng);
    
    // 該当タイルのスナップショット一覧取得
    const snapshots = await this.getSnapshotsForTile(TLX, TLY);
    
    // 一覧表示（アコーディオン式）
    const container = document.getElementById("wps-timetravel-list");
    if (container) {
      container.innerHTML = snapshots.length === 0 
        ? `<div class="text-sm text-gray-500 text-center p-4">${t`${'no_items'}`}</div>`
        : snapshots.map(snapshot => this.renderSnapshotItem(snapshot)).join('');
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
          fullKey: key,
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

  private renderSnapshotItem(snapshot: any): string {
    const locale = I18nManager.getCurrentLocale();
    const localeString = locale === 'ja' ? 'ja-JP' : 'en-US';
    const timeFormat = {
      year: 'numeric' as const,
      month: '2-digit' as const,
      day: '2-digit' as const,
      hour: '2-digit' as const,
      minute: '2-digit' as const
    };
    const formattedTime = new Date(snapshot.timestamp).toLocaleString(localeString, timeFormat);
    
    return `
      <div class="border-b">
        <div class="p-2 cursor-pointer hover:bg-gray-50" onclick="this.parentElement.querySelector('.details').classList.toggle('hidden')">
          <div class="text-sm font-medium">${formattedTime}</div>
          <div class="text-xs text-gray-500">${snapshot.id}</div>
        </div>
        <div class="details hidden p-2 bg-gray-50">
          <div class="flex gap-2">
            <button class="btn btn-sm btn-primary wps-draw-btn" data-snapshot-key="${snapshot.fullKey}">
              ${t`${'draw_image'}`}
            </button>
            <button class="btn btn-sm btn-error wps-delete-btn" data-snapshot-key="${snapshot.fullKey}">
              ${t`${'delete'}`}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  async deleteFavorite(fullKey: string): Promise<void> {
    if (!confirm(t`${'delete_confirm'}`)) return;
    
    try {
      await chrome.storage.local.remove(fullKey);
      this.showToast(t`${'deleted_message'}`);
      
      // 一覧更新
      const position = getCurrentPosition();
      if (position) {
        this.renderSnapshots(position.lat, position.lng);
      }
    } catch (error) {
      this.showToast(`Delete failed: ${error}`);
    }
  }

  async drawSnapshot(fullKey: string): Promise<void> {
    try {
      // スナップショット読み込み
      const result = await chrome.storage.local.get(fullKey);
      if (!result[fullKey]) {
        this.showToast('Snapshot not found');
        return;
      }
      
      // blob変換
      const uint8Array = new Uint8Array(result[fullKey]);
      const blob = new Blob([uint8Array], { type: 'image/png' });
      
      // blob→dataURL変換
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      
      // ImageItem生成
      const timestamp = parseInt(fullKey.split('_')[2]);
      const imageItem: ImageItem = {
        key: fullKey,
        dataUrl: dataUrl,
        title: `Snapshot ${fullKey.replace('tile_snapshot_', '')}`,
        createdAt: new Date(timestamp).toISOString()
      };
      
      // タイル座標取得（スナップショットのタイル座標）
      const tileX = parseInt(fullKey.split('_')[3]);
      const tileY = parseInt(fullKey.split('_')[4]);
      
      // タイル左上角座標設定
      const coords = {
        TLX: tileX,
        TLY: tileY,
        PxX: 0,  // タイル左上角
        PxY: 0
      };
      
      // TileOverlay機能で描画
      const tileOverlay = (window as any).wplaceStudio?.tileOverlay;
      
      if (tileOverlay) {
        await tileOverlay.drawImageWithCoords(coords, imageItem);
        this.showToast('Snapshot drawn successfully');
      } else {
        this.showToast('TileOverlay not available');
      }
      
    } catch (error) {
      console.error('Draw snapshot failed:', error);
      this.showToast(`Draw failed: ${error}`);
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
