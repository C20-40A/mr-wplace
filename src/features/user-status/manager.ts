import { WPlaceUserData } from "../../types/user-data";
import { StatusUIComponents } from "./ui/components";
import { StatusCalculator } from "./services/calculator";
import { TimerService } from "./services/timer-service";
import { NotificationModal } from "./ui/notification-modal";

export class StatusManager {
  private uiComponents = new StatusUIComponents();
  private calculator = new StatusCalculator();
  private timerService = new TimerService();
  private notificationModal = new NotificationModal();
  private static readonly ALARM_THRESHOLD_KEY = "ALARM_THRESHOLD";
  private static readonly ALARM_ENABLED_STATE_KEY = "ALARM_ENABLED_STATE";

  private container: HTMLElement;
  private nextLevelBadge: HTMLElement;
  private chargeCountdown: HTMLElement;
  private currentUserData?: WPlaceUserData;

  constructor() {
    this.container = this.uiComponents.createContainer();
    this.nextLevelBadge = this.uiComponents.createNextLevelBadge();
    this.chargeCountdown = this.uiComponents.createChargeCountdown();
    this.setupContainer();
    this.setupEventListeners();
    this.hideAll();
  }

  private setupContainer(): void {
    this.container.appendChild(this.chargeCountdown);
    this.container.appendChild(this.nextLevelBadge);
  }

  private setupEventListeners(): void {
    this.container.addEventListener("click", () => {
      if (this.currentUserData) {
        this.notificationModal.show(this.currentUserData);
      }
    });
  }

  private hideAll(): void {
    this.nextLevelBadge.style.display = "none";
    this.chargeCountdown.style.display = "none";
  }

  private showNextLevelBadge(): void {
    this.nextLevelBadge.style.display = "block";
  }

  private showChargeCountdown(): void {
    this.chargeCountdown.style.display = "block";
  }

  updateFromUserData(userData: WPlaceUserData): void {
    console.log("🧑‍🎨: StatusManager updating from userData");
    this.currentUserData = userData;

    // アラーム設定中の場合、charge変化で時刻更新
    this.handleChargeAlarmUpdate(userData);

    if (userData.level !== undefined && userData.pixelsPainted !== undefined) {
      const remainingPixels = this.calculator.calculateNextLevelPixels(
        userData.level,
        userData.pixelsPainted
      );

      if (remainingPixels > 0) {
        const levelGaugeHtml = this.calculator.generateLevelGaugeOnly(
          remainingPixels,
          userData.level
        );
        this.nextLevelBadge.innerHTML = `⬆️ ${new Intl.NumberFormat().format(
          remainingPixels
        )} px<br>${levelGaugeHtml}`;
        this.showNextLevelBadge();
      }
    }

    if (userData.charges) {
      const chargeData = this.getChargeData(userData.charges);
      const chargeGaugeHtml = this.calculator.generateChargeGaugeHtml(
        chargeData.current,
        chargeData.max
      );

      this.timerService.startChargeCountdown(
        userData.charges,
        (timeText: string) => {
          this.chargeCountdown.innerHTML = `${timeText}<br>${chargeGaugeHtml}`;
        }
      );
      this.showChargeCountdown();
    }
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  destroy(): void {
    this.timerService.destroy();
    this.notificationModal.destroy();
    this.container.remove();
  }

  private async getAlarmThreshold(): Promise<number> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [StatusManager.ALARM_THRESHOLD_KEY],
        (result) => {
          const threshold = result[StatusManager.ALARM_THRESHOLD_KEY];
          resolve(threshold !== undefined ? threshold : 80);
        }
      );
    });
  }

  private async getAlarmEnabledState(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [StatusManager.ALARM_ENABLED_STATE_KEY],
        (result) => {
          const enabled = result[StatusManager.ALARM_ENABLED_STATE_KEY];
          resolve(enabled === true);
        }
      );
    });
  }

  private async getAlarmInfo(): Promise<any> {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_ALARM_INFO" }, (response) => {
        if (chrome.runtime.lastError) {
          console.log(
            "🧑‍🎨: Alarm info error:",
            chrome.runtime.lastError.message
          );
          resolve(null);
        } else {
          resolve(response);
        }
      });
    });
  }

  private calculateAlarmTime(charges: any, threshold: number): Date | null {
    const globalChargeData: any = (window as any).wplaceChargeData;

    let current: number;
    let max: number;
    let cooldownMs: number;

    if (globalChargeData) {
      current = this.calculator.calculateCurrentCharge(globalChargeData);
      max = globalChargeData.max;
      cooldownMs = globalChargeData.cooldownMs || 30000;
    } else {
      const timeData = this.calculator.calculateTimeToFull(charges);
      current = timeData.current;
      max = timeData.max;
      cooldownMs = timeData.cooldownMs;
    }

    const requiredCharges = (max * threshold) / 100;

    if (current >= requiredCharges) return null;

    const neededCharges = requiredCharges - current;
    const requiredMs = neededCharges * cooldownMs;

    return new Date(Date.now() + requiredMs);
  }

  private getChargeData(charges: any): { current: number; max: number } {
    const globalChargeData: any = (window as any).wplaceChargeData;

    if (globalChargeData) {
      const calculatedCurrent = this.calculator.calculateCurrentCharge(globalChargeData);
      return {
        current: calculatedCurrent,
        max: globalChargeData.max,
      };
    }

    const timeData = this.calculator.calculateTimeToFull(charges);
    return {
      current: timeData.current,
      max: timeData.max,
    };
  }

  private async handleChargeAlarmUpdate(
    userData: WPlaceUserData
  ): Promise<void> {
    const enabled = await this.getAlarmEnabledState();
    if (!enabled) return;

    if (!userData.charges) return;

    const threshold = await this.getAlarmThreshold();
    const newAlarmTime = this.calculateAlarmTime(userData.charges, threshold);

    if (!newAlarmTime) {
      console.log("🧑‍🎨: Threshold reached, stopping alarm (enable maintained)");
      chrome.runtime.sendMessage({ type: "STOP_CHARGE_ALARM" });
      return;
    }

    chrome.runtime.sendMessage({ type: "STOP_CHARGE_ALARM" });
    chrome.runtime.sendMessage({
      type: "START_CHARGE_ALARM",
      when: newAlarmTime.getTime(),
    });

    console.log(
      "🧑‍🎨: Alarm updated for charge change to:",
      newAlarmTime.toLocaleTimeString()
    );
  }
}
