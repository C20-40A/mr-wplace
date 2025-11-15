/**
 * User status manager for inject context
 * Based on src/features/user-status/manager.ts
 * Simplified version without Chrome storage/runtime API dependencies
 */

import { StatusUIComponents } from "./ui-components";
import { StatusCalculator } from "../../features/user-status/services/calculator";
import { TimerService } from "../../features/user-status/services/timer-service";

interface WPlaceUserData {
  level?: number;
  pixelsPainted?: number;
  charges?: {
    count: number;
    max: number;
    cooldownMs: number;
  };
  extraColorsBitmap?: number;
}

export class StatusManager {
  private uiComponents = new StatusUIComponents();
  private calculator = new StatusCalculator();
  private timerService = new TimerService();

  private container: HTMLElement;
  private nextLevelBadge: HTMLElement;
  private chargeCountdown: HTMLElement;
  private currentUserData?: WPlaceUserData;

  constructor() {
    this.container = this.uiComponents.createContainer();
    this.nextLevelBadge = this.uiComponents.createNextLevelBadge();
    this.chargeCountdown = this.uiComponents.createChargeCountdown();
    this.setupContainer();
    this.hideAll();
  }

  private setupContainer(): void {
    this.container.appendChild(this.chargeCountdown);
    this.container.appendChild(this.nextLevelBadge);
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.container.addEventListener("click", () => {
      if (this.currentUserData) {
        // Send message to content script to open modal
        window.postMessage(
          {
            source: "mr-wplace-open-user-modal",
            userData: this.currentUserData,
          },
          "*"
        );
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
    console.log("🧑‍🎨: StatusManager updating from userData (inject context)");
    this.currentUserData = userData;

    // Update ColorFilterManager with extraColorsBitmap
    if (window.mrWplace?.colorFilterManager) {
      if (typeof window.mrWplace.colorFilterManager.setExtraColorsBitmap === "function") {
        window.mrWplace.colorFilterManager.setExtraColorsBitmap(
          userData.extraColorsBitmap
        );
        console.log(
          "🧑‍🎨: Set extraColorsBitmap:",
          userData.extraColorsBitmap
        );
      }
    }

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
    this.container.remove();
  }

  private getChargeData(charges: any): { current: number; max: number } {
    const globalChargeData = window.mrWplace?.wplaceChargeData;

    if (globalChargeData) {
      const calculatedCurrent =
        this.calculator.calculateCurrentCharge(globalChargeData);
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
}
