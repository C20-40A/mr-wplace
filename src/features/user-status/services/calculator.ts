export class StatusCalculator {
  calculateNextLevelPixels(level: number, pixelsPainted: number): number {
    const nextLevelPixels = Math.ceil(
      Math.pow(Math.floor(level) * Math.pow(30, 0.65), 1 / 0.65) - pixelsPainted
    );
    return Math.max(0, nextLevelPixels);
  }

  generateProgressGaugeHtml(
    remainingPixels: number,
    currentLevel: number
  ): string {
    const nextLevel = Math.floor(currentLevel) + 1;
    const totalPixelsForNextLevel = Math.ceil(
      Math.pow(nextLevel * Math.pow(30, 0.65), 1 / 0.65)
    );
    const currentLevelPixels = Math.ceil(
      Math.pow(Math.floor(currentLevel) * Math.pow(30, 0.65), 1 / 0.65)
    );
    const totalPixelsNeeded = totalPixelsForNextLevel - currentLevelPixels;

    const currentProgressPixels = totalPixelsNeeded - remainingPixels;
    const progressRatio = Math.max(
      0,
      Math.min(1, currentProgressPixels / totalPixelsNeeded)
    );

    const progressWidth = Math.floor(progressRatio * 40);
    const gaugeHtml = `
      <div style="display:inline-block;width:40px;height:6px;background-color: var(--color-base-300);border-radius:3px;position:relative;margin-right:4px;">
        <div style="width:${progressWidth}px;height:6px;background-color:#3B82F6;border-radius:3px;position:absolute;top:0;left:0;"></div>
      </div>
    `;

    return `${gaugeHtml} +${new Intl.NumberFormat().format(remainingPixels)}px`;
  }

  calculateTimeToFull(charges: {
    count: number;
    max: number;
    cooldownMs: number;
  }): {
    current: number;
    max: number;
    cooldownMs: number;
    timeToFullMs: number;
  } {
    const currentCharges = charges.count || 0;
    const maxCharges = charges.max || 1;
    const cooldownMs = charges.cooldownMs || 30000;
    const chargesNeeded = maxCharges - currentCharges;
    const timeToFullMs = chargesNeeded * cooldownMs;

    return {
      current: currentCharges,
      max: maxCharges,
      cooldownMs,
      timeToFullMs,
    };
  }

  formatTimeRemaining(remainingMs: number): string {
    if (remainingMs <= 0) return "⚡ FULL";

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `⚡ ${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `⚡ ${minutes}m ${seconds}s`;
    } else {
      return `⚡ ${seconds}s`;
    }
  }

  generateChargeGaugeHtml(current: number, max: number): string {
    const progressRatio = Math.max(0, Math.min(1, current / max));
    const progressPercent = Math.floor(progressRatio * 100);

    return `
      <div style="display:block;width:100%;height:6px;background-color: var(--color-base-300);border-radius:3px;position:relative;">
        <div style="width:${progressPercent}%;height:6px;background-color:#FCD34D;border-radius:3px;position:absolute;top:0;left:0;"></div>
      </div>
    `;
  }

  generateLevelGaugeOnly(
    remainingPixels: number,
    currentLevel: number
  ): string {
    const nextLevel = Math.floor(currentLevel) + 1;
    const totalPixelsForNextLevel = Math.ceil(
      Math.pow(nextLevel * Math.pow(30, 0.65), 1 / 0.65)
    );
    const currentLevelPixels = Math.ceil(
      Math.pow(Math.floor(currentLevel) * Math.pow(30, 0.65), 1 / 0.65)
    );
    const totalPixelsNeeded = totalPixelsForNextLevel - currentLevelPixels;

    const currentProgressPixels = totalPixelsNeeded - remainingPixels;
    const progressRatio = Math.max(
      0,
      Math.min(1, currentProgressPixels / totalPixelsNeeded)
    );

    const progressPercent = Math.floor(progressRatio * 100);

    return `
      <div style="display:block;width:100%;height:6px;background-color: var(--color-base-300);border-radius:3px;position:relative;">
        <div style="width:${progressPercent}%;height:6px;background-color:#3B82F6;border-radius:3px;position:absolute;top:0;left:0;"></div>
      </div>
    `;
  }

  calculateCurrentCharge(globalChargeData: any): number {
    if (!globalChargeData.startTime || !globalChargeData.cooldownMs) {
      return globalChargeData.current || 0;
    }

    const elapsed = Date.now() - globalChargeData.startTime;
    const recoveredCharges = Math.floor(elapsed / globalChargeData.cooldownMs);
    return Math.min(
      globalChargeData.current + recoveredCharges,
      globalChargeData.max
    );
  }
}
