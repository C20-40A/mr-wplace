import { RuntimeChargeData } from "../../../types/global";
import { StatusCalculator } from "./calculator";

export interface ChargeData {
  current: number;
  max: number;
  cooldownMs: number;
  timeToFull: number;
  startTime: number;
}

export class TimerService {
  private calculator = new StatusCalculator();
  private intervalId?: number;

  startChargeCountdown(
    charges: { count: number; max: number; cooldownMs: number },
    updateCallback: (timeText: string) => void
  ): void {
    const chargeData = this.calculator.calculateTimeToFull(charges);

    if (!window.mrWplace) throw new Error("window.mrWplace not found");
    window.mrWplace.wplaceChargeData = {
      ...chargeData,
      timeToFull: chargeData.timeToFullMs,
      startTime: Date.now(),
    };

    updateCallback(this.getCurrentTimeText());

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = window.setInterval(() => {
      const timeText = this.getCurrentTimeText();
      updateCallback(timeText);

      if (timeText === "⚡ FULL" && this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = undefined;
      }
    }, 1000);
  }

  private getCurrentTimeText(): string {
    const data = window.mrWplace?.wplaceChargeData;
    if (!data) return "...";

    const elapsed = Date.now() - data.startTime;
    const remainingMs = Math.max(0, data.timeToFull - elapsed);

    return this.calculator.formatTimeRemaining(remainingMs);
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (window.mrWplace) delete window.mrWplace.wplaceChargeData;
  }
}
