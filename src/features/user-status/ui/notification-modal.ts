import { createModal, ModalElements } from "../../../utils/modal";
import { WPlaceUserData } from "../../../types/user-data";
import { StatusCalculator } from "../services/calculator";

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
  private currentAlarmInfo: any = null;
  private currentThreshold: number = 80;
  private isFirstRender: boolean = true;

  show(userData: WPlaceUserData): void {
    this.userData = userData;
    this.isFirstRender = true;

    if (!this.modalElements) {
      this.modalElements = createModal({
        id: "user-status-notification-modal",
        title: "User Status Details",
        maxWidth: "32rem",
      });
    }

    this.renderContent();
    this.modalElements.modal.showModal();
    this.startPeriodicUpdate();

    this.modalElements.modal.addEventListener("close", () => {
      this.stopPeriodicUpdate();
    });
  }

  private startPeriodicUpdate(): void {
    this.stopPeriodicUpdate();
    this.updateAlarmInfoAndRender();
    this.updateInterval = window.setInterval(async () => {
      await this.updateAlarmInfoAndRender();
    }, 1000);
  }

  private async updateAlarmInfoAndRender(): Promise<void> {
    this.currentAlarmInfo = await this.getAlarmInfo();
    this.renderContent();
  }

  private stopPeriodicUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private getChargeData(): { current: number; max: number; cooldownMs: number; timeToFullMs: number } {
    if (!this.userData?.charges) throw new Error("No charge data available");

    const globalChargeData: ChargeData = (window as any).wplaceChargeData;
    
    if (globalChargeData) {
      const elapsed = Date.now() - globalChargeData.startTime;
      const remainingMs = Math.max(0, globalChargeData.timeToFull - elapsed);
      return {
        current: globalChargeData.current,
        max: globalChargeData.max,
        cooldownMs: globalChargeData.cooldownMs || 30000,
        timeToFullMs: remainingMs
      };
    }

    const timeData = this.calculator.calculateTimeToFull(this.userData.charges);
    return {
      current: timeData.current,
      max: timeData.max,
      cooldownMs: timeData.cooldownMs,
      timeToFullMs: timeData.timeToFullMs
    };
  }

  private calculateThresholdTime(threshold: number): string {
    if (!this.userData?.charges) return "--:--";

    const { current, max, cooldownMs } = this.getChargeData();
    const requiredCharges = (max * threshold) / 100;
    
    if (current >= requiredCharges) return "Already reached";

    const neededCharges = requiredCharges - current;
    const requiredMs = neededCharges * cooldownMs;
    const targetTime = new Date(Date.now() + requiredMs);
    
    return targetTime.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  private async getAlarmInfo(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_ALARM_INFO" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log("🧑‍🎨: Alarm info error:", chrome.runtime.lastError.message);
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  private renderContent(): void {
    if (!this.modalElements || !this.userData) return;

    if (this.isFirstRender) {
      this.renderInitialContent();
      this.isFirstRender = false;
    } else {
      this.updateDynamicContent();
    }
  }

  private renderInitialContent(): void {
    const sections = [];

    if (this.userData?.level !== undefined && this.userData?.pixelsPainted !== undefined) {
      sections.push(this.createLevelSection());
    }

    if (this.userData?.charges) {
      sections.push(this.createChargeSection());
      sections.push(this.createChargeMonitorSection());
    }

    this.modalElements!.container.innerHTML = sections.join("");
    this.setupChargeMonitorListeners();
  }

  private updateDynamicContent(): void {
    if (!this.userData?.charges) return;

    // Charge Status更新
    const chargeStatusElement = document.getElementById("charge-status-content");
    if (chargeStatusElement) {
      chargeStatusElement.innerHTML = this.createChargeStatusContent();
    }

    // Alarm Status更新  
    const alarmStatusElement = document.getElementById("alarm-status-content");
    if (alarmStatusElement) {
      alarmStatusElement.innerHTML = this.createAlarmStatusHTML();
    }

    // Estimated Time更新
    const estimatedTimeElement = document.getElementById("estimatedTime");
    if (estimatedTimeElement) {
      estimatedTimeElement.textContent = `Estimated time: ${this.calculateThresholdTime(this.currentThreshold)}`;
    }
  }

  private createLevelSection(): string {
    if (!this.userData) return "";

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
                 style="width: ${Math.max(10, 100 - remainingPixels / 1000)}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  private createChargeSection(): string {
    return `
      <div class="mb-6">
        <h4 class="font-semibold text-md mb-3">⚡ Charge Status</h4>
        <div id="charge-status-content">
          ${this.createChargeStatusContent()}
        </div>
      </div>
    `;
  }

  private createChargeStatusContent(): string {
    const { current, max, timeToFullMs } = this.getChargeData();
    const timeRemaining = this.calculator.formatTimeRemaining(timeToFullMs);
    const percentage = (Math.floor(current) / max) * 100;
    
    const fullChargeTime = new Date(Date.now() + timeToFullMs);
    const formattedTime = fullChargeTime.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const timeDisplay = timeToFullMs > 0 
      ? `<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
           <div class="flex justify-between items-center mb-2">
             <span class="text-sm font-medium text-blue-800">⏱️ Time to Full:</span>
             <span class="font-mono text-blue-900">${timeRemaining.replace("⚡ ", "")}</span>
           </div>
           <div class="flex justify-between items-center">
             <span class="text-sm font-medium text-blue-800">🎯 Full Charge At:</span>
             <span class="font-mono text-blue-900">${formattedTime}</span>
           </div>
         </div>`
      : `<div class="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
           <span class="text-green-800 font-semibold">⚡ FULLY CHARGED!</span>
         </div>`;

    return `
      <div class="space-y-3">
        <div class="flex justify-between">
          <span>Current Charges:</span>
          <span class="font-mono text-lg">${Math.floor(current)}/${max}</span>
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
        ${timeDisplay}
      </div>
    `;
  }

  private createAlarmStatusHTML(): string {
    if (this.currentAlarmInfo) {
      const alarmTime = new Date(this.currentAlarmInfo.scheduledTime).toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
      return `
        <div style="background-color: #dcfce7; padding: 8px 12px; border-radius: 6px; margin-top: 8px; border: 1px solid #bbf7d0;">
          <div style="font-size: 13px; color: #15803d; font-weight: 500;">⏰ Alarm Active</div>
          <div style="font-size: 12px; color: #16a34a; margin-top: 2px;">Scheduled: ${alarmTime}</div>
        </div>
      `;
    }
    
    return `
      <div style="background-color: #f3f4f6; padding: 8px 12px; border-radius: 6px; margin-top: 8px; border: 1px solid #d1d5db;">
        <div style="font-size: 13px; color: #6b7280; font-weight: 500;">😴 No Alarm Set</div>
      </div>
    `;
  }

  private createChargeMonitorSection(): string {
    return `
      <div class="mb-6 border-t pt-4" style="border-top: 1px solid #e5e7eb; margin-bottom: 24px; padding-top: 16px;">
        <h4 style="font-weight: 600; font-size: 16px; margin-bottom: 12px;">🔔 Charge Alarm</h4>
        
        <div style="margin-bottom: 16px;">
          <label style="font-size: 14px; font-weight: 500; color: #374151; display: block; margin-bottom: 8px;">
            Notification Threshold: <span id="thresholdValue">${this.currentThreshold}</span>%
          </label>
          <input type="range" id="chargeThreshold" min="10" max="100" value="${this.currentThreshold}" step="5" 
                 style="width: 100%; margin-bottom: 8px;">
          <div id="estimatedTime" style="font-size: 12px; color: #6b7280; background-color: #f9fafb; padding: 6px 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
            Estimated time: ${this.calculateThresholdTime(this.currentThreshold)}
          </div>
        </div>
        
        <div style="display: flex; gap: 8px;">
          <button id="startChargeMonitor" style="background-color: #16a34a; color: white; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500;">
            Start Monitor
          </button>
          <button id="stopChargeMonitor" style="background-color: #dc2626; color: white; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500;">
            Stop Monitor
          </button>
        </div>
        <div id="alarm-status-content">
          ${this.createAlarmStatusHTML()}
        </div>
      </div>
    `;
  }

  private setupChargeMonitorListeners(): void {
    const startButton = document.getElementById("startChargeMonitor");
    const stopButton = document.getElementById("stopChargeMonitor");
    const thresholdSlider = document.getElementById("chargeThreshold") as HTMLInputElement;
    const thresholdValue = document.getElementById("thresholdValue");
    const estimatedTime = document.getElementById("estimatedTime");

    if (!startButton || !stopButton) return;

    startButton.addEventListener("click", () => {
      const when = Date.now() + 60000; // 1分後 (テスト用)
      chrome.runtime.sendMessage({ type: "START_CHARGE_ALARM", when });
      console.log("🧑‍🎨: Charge monitor started");
    });

    stopButton.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "STOP_CHARGE_ALARM" });
      console.log("🧑‍🎨: Charge monitor stopped");
    });

    if (thresholdSlider && thresholdValue && estimatedTime) {
      const updateThresholdDisplay = () => {
        const threshold = parseInt(thresholdSlider.value);
        this.currentThreshold = threshold;
        thresholdValue.textContent = threshold.toString();
        estimatedTime.textContent = `Estimated time: ${this.calculateThresholdTime(threshold)}`;
      };
      
      thresholdSlider.addEventListener("input", updateThresholdDisplay);
    }
  }

  destroy(): void {
    this.stopPeriodicUpdate();
    if (this.modalElements) {
      this.modalElements.modal.remove();
      this.modalElements = undefined;
    }
  }
}
