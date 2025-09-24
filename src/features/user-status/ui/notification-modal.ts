import { createModal, ModalElements } from "../../../utils/modal";
import { WPlaceUserData } from "../../../types/user-data";
import { StatusCalculator } from "../services/calculator";
import { TimerService } from "../services/timer-service";

interface ChargeData {
  current: number;
  max: number;
  cooldownMs: number;
  timeToFull: number;
  startTime: number;
}

export class NotificationModal {
  private calculator = new StatusCalculator();
  private modalElements?: ModalElements;
  private userData?: WPlaceUserData;
  private updateInterval?: number;

  show(userData: WPlaceUserData): void {
    this.userData = userData;
    
    if (!this.modalElements) {
      this.modalElements = createModal({
        id: "user-status-notification-modal",
        title: "User Status Details",
        maxWidth: "32rem"
      });
    }

    this.renderContent();
    this.modalElements.modal.showModal();
    this.startPeriodicUpdate();

    // Modal close時にinterval停止
    this.modalElements.modal.addEventListener('close', () => {
      this.stopPeriodicUpdate();
    });
  }

  private startPeriodicUpdate(): void {
    this.stopPeriodicUpdate();
    // UI更新のみ（時間計算はグローバル状態から）
    this.updateInterval = window.setInterval(() => {
      this.renderContent();
    }, 1000);
  }

  private stopPeriodicUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private renderContent(): void {
    if (!this.modalElements || !this.userData) return;

    const sections = [];

    if (this.userData.level !== undefined && this.userData.pixelsPainted !== undefined) {
      sections.push(this.createLevelSection());
    }

    if (this.userData.charges) {
      sections.push(this.createChargeSection());
      sections.push(this.createChargeMonitorSection());
    }

    this.modalElements.container.innerHTML = sections.join('');
    this.setupChargeMonitorListeners();
  }

  private createLevelSection(): string {
    if (!this.userData) return '';

    const currentLevel = Math.floor(this.userData.level);
    const nextLevel = currentLevel + 1;
    const remainingPixels = this.calculator.calculateNextLevelPixels(
      this.userData.level, 
      this.userData.pixelsPainted!
    );

    return `
      <div class="mb-6">
        <h4 class="font-semibold text-md mb-3">🎯 Level Progress</h4>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span>Current Level:</span>
            <span class="font-mono">${currentLevel}</span>
          </div>
          <div class="flex justify-between">
            <span>Pixels Painted:</span>
            <span class="font-mono">${new Intl.NumberFormat().format(this.userData.pixelsPainted!)}</span>
          </div>
          <div class="flex justify-between">
            <span>Next Level (${nextLevel}):</span>
            <span class="font-mono text-blue-600">${new Intl.NumberFormat().format(remainingPixels)} px</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                 style="width: ${Math.max(10, 100 - (remainingPixels / 1000))}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  private createChargeMonitorSection(): string {
    return `
      <div class="mb-6 border-t pt-4" style="border-top: 1px solid #e5e7eb; margin-bottom: 24px; padding-top: 16px;">
        <h4 style="font-weight: 600; font-size: 16px; margin-bottom: 12px;">🔔 Charge Monitor</h4>
        <div style="display: flex; gap: 8px;">
          <button id="startChargeMonitor" style="
            background-color: #16a34a;
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 500;
          ">Start Monitor</button>
          <button id="stopChargeMonitor" style="
            background-color: #dc2626;
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            border: none;
            cursor: pointer;
            font-weight: 500;
          ">Stop Monitor</button>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Notifies when charge reaches 80%</p>
      </div>
    `;
  }

  private setupChargeMonitorListeners(): void {
    const startButton = document.getElementById('startChargeMonitor');
    const stopButton = document.getElementById('stopChargeMonitor');

    if (!startButton || !stopButton) return;

    startButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'START_CHARGE_MONITOR' });
      console.log("🧑‍🎨: Charge monitor started");
    });

    stopButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'STOP_CHARGE_MONITOR' });
      console.log("🧑‍🎨: Charge monitor stopped");
    });
  }

  private createChargeSection(): string {
    if (!this.userData?.charges) return '';

    // timer-service.tsのグローバル状態を読み取り
    const globalChargeData: ChargeData = (window as any).wplaceChargeData;
    
    let timeData, timeRemaining: string;
    if (globalChargeData) {
      // リアルタイム計算
      const elapsed = Date.now() - globalChargeData.startTime;
      const remainingMs = Math.max(0, globalChargeData.timeToFull - elapsed);
      timeRemaining = this.calculator.formatTimeRemaining(remainingMs);
      timeData = {
        current: globalChargeData.current,
        max: globalChargeData.max,
        timeToFullMs: remainingMs
      };
    } else {
      // フォールバック：従来ロジック
      timeData = this.calculator.calculateTimeToFull(this.userData.charges);
      timeRemaining = this.calculator.formatTimeRemaining(timeData.timeToFullMs);
    }

    const percentage = (Math.floor(timeData.current) / timeData.max) * 100;
    const fullChargeTime = new Date(Date.now() + timeData.timeToFullMs);
    const formattedTime = fullChargeTime.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `
      <div class="mb-6">
        <h4 class="font-semibold text-md mb-3">⚡ Charge Status</h4>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span>Current Charges:</span>
            <span class="font-mono text-lg">${Math.floor(timeData.current)}/${timeData.max}</span>
          </div>
          
          <div class="relative">
            <div class="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div class="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full transition-all duration-500 ease-out" 
                   style="width: ${percentage}%"></div>
            </div>
            <div class="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700">
              ${Math.round(percentage)}%
            </div>
          </div>
          
          ${timeData.timeToFullMs > 0 ? `
            <div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-medium text-blue-800">⏱️ Time to Full:</span>
                <span class="font-mono text-blue-900">${timeRemaining.replace('⚡ ', '')}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm font-medium text-blue-800">🎯 Full Charge At:</span>
                <span class="font-mono text-blue-900">${formattedTime}</span>
              </div>
            </div>
          ` : `
            <div class="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
              <span class="text-green-800 font-semibold">⚡ FULLY CHARGED!</span>
            </div>
          `}
        </div>
      </div>
    `;
  }

  destroy(): void {
    this.stopPeriodicUpdate();
    if (this.modalElements) {
      this.modalElements.modal.remove();
      this.modalElements = undefined;
    }
  }
}
