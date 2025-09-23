import { WPlaceUserData } from "../../types/user-data";
import { setupElementObserver } from "../../components/element-observer";

export class UserStatus {
  private container: HTMLElement;
  private nextLevelBadge: HTMLElement;
  private chargeCountdown: HTMLElement;
  private countdownInterval?: number;

  constructor() {
    this.container = this.createContainer();
    this.nextLevelBadge = this.createNextLevelBadge();
    this.chargeCountdown = this.createChargeCountdown();
    this.container.appendChild(this.nextLevelBadge);
    this.container.appendChild(this.chargeCountdown);
  }

  private createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    `;
    container.id = "user-status-container";
    return container;
  }

  private createNextLevelBadge(): HTMLElement {
    const badge = document.createElement("div");
    badge.style.cssText = `
      background-color: oklch(42.551% .161 282.339);
      color: white;
      padding: 2px 6px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      display: none;
      align-items: center;
      white-space: nowrap;
      min-width: 40px;
      justify-content: center;
      pointer-events: auto;
    `;
    return badge;
  }

  private createChargeCountdown(): HTMLElement {
    const countdown = document.createElement("div");
    countdown.style.cssText = `
      background-color: oklch(72.551% .161 82.339);
      color: white;
      padding: 2px 6px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      display: none;
      align-items: center;
      white-space: nowrap;
      min-width: 40px;
      justify-content: center;
      pointer-events: auto;
    `;
    return countdown;
  }

  init(): boolean {
    setupElementObserver([
      {
        id: "user-status-container",
        getTargetElement: () => document.body,
        createElement: (body) => {
          if (!document.getElementById("user-status-container")) {
            body.appendChild(this.container);
          }
        },
      },
    ]);

    // this.hideAll();
    return true;
  }

  private hideAll(): void {
    this.nextLevelBadge.style.display = "none";
    this.chargeCountdown.style.display = "none";
  }

  private showNextLevelBadge(): void {
    this.nextLevelBadge.style.display = "flex";
  }

  private showChargeCountdown(): void {
    this.chargeCountdown.style.display = "flex";
  }

  private updateNextLevelBadge(pixels: number): void {
    this.nextLevelBadge.textContent = `↗️ ${new Intl.NumberFormat().format(
      pixels
    )}`;
  }

  private updateFullChargeInfo(charges: { count: number; max: number; cooldownMs: number }): void {
    const currentCharges = charges.count || 0;
    const maxCharges = charges.max || 1;
    const cooldownMs = charges.cooldownMs || 30000;
    
    // Calculate charges needed and time to full
    const chargesNeeded = maxCharges - currentCharges;
    const timeToFullMs = chargesNeeded * cooldownMs;
    
    // Store data for countdown
    (window as any).wplaceChargeData = {
      current: currentCharges,
      max: maxCharges,
      cooldownMs: cooldownMs,
      timeToFull: timeToFullMs,
      startTime: Date.now()
    };
    
    // Initial display
    this.updateFullChargeDisplay();
    
    // Start countdown interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.countdownInterval = window.setInterval(() => {
      this.updateFullChargeDisplay();
    }, 1000);
  }

  private updateFullChargeDisplay(): void {
    const data = (window as any).wplaceChargeData;
    if (!data) return;
    
    const elapsed = Date.now() - data.startTime;
    const remainingMs = Math.max(0, data.timeToFull - elapsed);
    
    // If already at full charges
    if (data.current >= data.max || remainingMs <= 0) {
      this.chargeCountdown.textContent = "⚡ FULL";
      this.chargeCountdown.style.backgroundColor = "oklch(62.8% 0.257 160.1)";
      
      // Clear interval when full
      if (this.countdownInterval) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = undefined;
      }
      return;
    }
    
    // Convert to hours, minutes, seconds
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    let timeText = '';
    if (hours > 0) {
      timeText = `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      timeText = `${minutes}m ${seconds}s`;
    } else {
      timeText = `${seconds}s`;
    }
    
    // Calculate current charges (increases over time)
    const chargesGained = Math.floor(elapsed / data.cooldownMs);
    const currentCharges = Math.min(data.current + chargesGained, data.max);
    const chargesText = `${Math.floor(currentCharges)}/${data.max}`;
    
    this.chargeCountdown.textContent = `⚡ ${timeText} (${chargesText})`;
    this.chargeCountdown.style.backgroundColor = "oklch(72.551% .161 82.339)";
  }

  updateFromUserData(userData: WPlaceUserData): void {
    console.log("🧑‍🎨: UserStatus updating from userData");

    // Next Level Badge Update
    if (userData.level !== undefined && userData.pixelsPainted !== undefined) {
      const nextLevelPixels = Math.ceil(
        Math.pow(Math.floor(userData.level) * Math.pow(30, 0.65), 1 / 0.65) -
          userData.pixelsPainted
      );

      if (nextLevelPixels > 0) {
        this.updateNextLevelBadge(Math.max(0, nextLevelPixels));
        this.showNextLevelBadge();
      }
    }

    // Charge Countdown Update
    if (userData.charges) {
      this.updateFullChargeInfo(userData.charges);
      this.showChargeCountdown();
    }
  }

  destroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    // Clean up global charge data
    delete (window as any).wplaceChargeData;
    this.container.remove();
  }
}
