import { createModal, ModalElements } from "../../../components/modal";
import { WPlaceUserData } from "../../../types/user-data";
import { StatusCalculator } from "../services/calculator";
import { t } from "../../../i18n/manager";
import { storage, runtime } from "@/utils/browser-api";

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
  private static readonly ALARM_THRESHOLD_KEY = "ALARM_THRESHOLD";
  private static readonly ALARM_ENABLED_STATE_KEY = "ALARM_ENABLED_STATE";
  private currentEnabledState: boolean = false;

  private isAppleCalendarSupportedDevice(): boolean {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;

    return /iPhone/i.test(userAgent) || /Mac/i.test(platform);
  }

  show(userData: WPlaceUserData): void {
    this.userData = userData;
    this.isFirstRender = true;

    this.modalElements = createModal({
      id: "user-status-notification-modal",
      title: t`${"user_status_details"}`,
      maxWidth: "32rem",
    });

    this.renderContent();
    this.modalElements.modal.showModal();
    this.startPeriodicUpdate();

    this.loadAlarmState();

    this.modalElements.modal.addEventListener("close", () => {
      this.stopPeriodicUpdate();
    });
  }

  private async loadAlarmState(): Promise<void> {
    this.currentAlarmInfo = await this.getAlarmInfo();
    this.currentEnabledState = await this.getAlarmEnabledState();
    this.currentThreshold = await this.getAlarmThreshold();
    this.updateAlarmSection();
  }

  private startPeriodicUpdate(): void {
    this.stopPeriodicUpdate();
    this.updateInterval = window.setInterval(async () => {
      await this.updateAlarmInfoAndRender();
    }, 1000);
  }

  private async updateAlarmInfoAndRender(): Promise<void> {
    this.currentAlarmInfo = await this.getAlarmInfo();
    this.currentEnabledState = await this.getAlarmEnabledState();
    this.renderContent();
  }

  private stopPeriodicUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  private getChargeData(): {
    current: number;
    max: number;
    cooldownMs: number;
    timeToFullMs: number;
  } {
    if (!this.userData?.charges) throw new Error("No charge data available");

    const globalChargeData = window.mrWplace?.wplaceChargeData;

    if (globalChargeData) {
      const elapsed = Date.now() - globalChargeData.startTime;
      const remainingMs = Math.max(0, globalChargeData.timeToFull - elapsed);
      const calculatedCurrent =
        this.calculator.calculateCurrentCharge(globalChargeData);
      return {
        current: calculatedCurrent,
        max: globalChargeData.max,
        cooldownMs: globalChargeData.cooldownMs || 30000,
        timeToFullMs: remainingMs,
      };
    }

    const timeData = this.calculator.calculateTimeToFull(this.userData.charges);
    return {
      current: timeData.current,
      max: timeData.max,
      cooldownMs: timeData.cooldownMs,
      timeToFullMs: timeData.timeToFullMs,
    };
  }

  private calculateThresholdTime(threshold: number): string {
    const alarmTime = this.calculateAlarmTime(threshold);
    if (!alarmTime) return t`${"already_reached"}`;

    return this.formatMonthDayTime(alarmTime);
  }

  private formatMonthDayTime(date: Date): string {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    return `${month}/${day} ${hours}:${minutes.toString().padStart(2, "0")}`;
  }

  private calculateAlarmTime(threshold: number): Date | null {
    if (!this.userData?.charges) return null;

    const { current, max, cooldownMs } = this.getChargeData();
    const requiredCharges = (max * threshold) / 100;

    if (current >= requiredCharges) return null;

    const neededCharges = requiredCharges - current;
    const requiredMs = neededCharges * cooldownMs;

    return new Date(Date.now() + requiredMs);
  }

  private generateGoogleCalendarLink(alarmTime: Date): string {
    const startTime =
      alarmTime.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const endTime =
      new Date(alarmTime.getTime() + 60 * 1000)
        .toISOString()
        .replace(/[-:]/g, "")
        .split(".")[0] + "Z";
    const eventName = encodeURIComponent(t`${"wplace_charged_event"}`);
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventName}&dates=${startTime}/${endTime}`;
  }

  private generateAppleCalendarLink(alarmTime: Date): string {
    const endTime = new Date(alarmTime.getTime() + 60 * 1000);
    const pad = (value: number) => value.toString().padStart(2, "0");
    const formatUtcDate = (date: Date) =>
      `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
        date.getUTCDate(),
      )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
        date.getUTCSeconds(),
      )}Z`;
    const escapeIcsText = (value: string) =>
      value
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    const eventName = escapeIcsText(t`${"wplace_charged_event"}`);
    const uid = `wplace-charge-${alarmTime.getTime()}@wplace`;
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//WPlace Studio//Charge Alarm//EN",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${formatUtcDate(new Date())}`,
      `DTSTART:${formatUtcDate(alarmTime)}`,
      `DTEND:${formatUtcDate(endTime)}`,
      `SUMMARY:${eventName}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  }

  private async getAlarmInfo(): Promise<any> {
    const response = await runtime
      .sendMessage({ type: "GET_ALARM_INFO" })
      .catch((error) => {
        console.log("🧑‍🎨: Alarm info error:", error);
        return null;
      });
    return response;
  }

  private async getAlarmEnabledState(): Promise<boolean> {
    const result = await storage.get([
      NotificationModal.ALARM_ENABLED_STATE_KEY,
    ]);
    const enabled = result[NotificationModal.ALARM_ENABLED_STATE_KEY];
    return enabled === true;
  }

  private async getAlarmThreshold(): Promise<number> {
    const result = await storage.get([NotificationModal.ALARM_THRESHOLD_KEY]);
    const threshold = result[NotificationModal.ALARM_THRESHOLD_KEY];
    return threshold !== undefined ? threshold : 80;
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

    if (this.userData?.charges) {
      sections.push(this.createChargeSection());
    }
    if (
      this.userData?.level !== undefined &&
      this.userData?.pixelsPainted !== undefined
    ) {
      sections.push(this.createLevelSection());
    }
    if (this.userData?.charges) {
      sections.push(this.createChargeMonitorLoadingSection());
    }

    this.modalElements!.container.innerHTML = sections.join("");
  }

  private updateAlarmSection(): void {
    const alarmSection = document.getElementById("alarm-section-container");
    if (!alarmSection) return;

    alarmSection.innerHTML = this.createChargeMonitorSection();
    this.setupChargeMonitorListeners();
  }

  private updateDynamicContent(): void {
    if (!this.userData?.charges) return;

    // Charge Status更新
    const chargeStatusElement = document.getElementById(
      "charge-status-content",
    );
    if (chargeStatusElement) {
      chargeStatusElement.innerHTML = this.createChargeStatusContent();
    }

    // Alarm Status更新
    const alarmStatusElement = document.getElementById("alarm-status-content");
    if (alarmStatusElement) {
      alarmStatusElement.innerHTML = this.createAlarmStatusHTML();
    }

    // Estimated Time + Calendar button更新
    const estimatedTimeElement = document.getElementById("estimatedTime");
    if (estimatedTimeElement) {
      const thresholdTime = this.calculateThresholdTime(this.currentThreshold);
      estimatedTimeElement.textContent = `${t`${"estimated_time"}`}: ${thresholdTime}`;
      this.updateCalendarButtonState();
    }
  }

  private updateCalendarButtonState(): void {
    const isReached = !this.calculateAlarmTime(this.currentThreshold);
    const googleButton = document.getElementById(
      "addToCalendar",
    ) as HTMLButtonElement | null;
    const appleButton = document.getElementById(
      "addToAppleCalendar",
    ) as HTMLButtonElement | null;

    if (googleButton) {
      googleButton.disabled = isReached;
      googleButton.style.backgroundColor = isReached ? "#9ca3af" : "#3b82f6";
      googleButton.style.cursor = isReached ? "not-allowed" : "pointer";
      googleButton.style.opacity = isReached ? "0.5" : "1";
    }

    if (appleButton) {
      appleButton.disabled = isReached;
      appleButton.style.cursor = isReached ? "not-allowed" : "pointer";
      appleButton.style.opacity = isReached ? "0.5" : "1";
    }
  }

  private createLevelSection(): string {
    if (!this.userData) return "";

    const currentLevel = Math.floor(this.userData.level);
    const remainingPixels = this.calculator.calculateNextLevelPixels(
      this.userData.level,
      this.userData.pixelsPainted!,
    );

    const levelGaugeHtml = this.calculator.generateLevelGaugeOnly(
      remainingPixels,
      this.userData.level,
    );

    return `
      <div class="mb-6">
        <h4 class="font-semibold text-md mb-3">🎯 ${t`${"level_progress"}`}</h4>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span>${t`${"current_level"}`}:</span>
            <span class="font-mono">${currentLevel}Lv</span>
          </div>
          <div class="flex justify-between">
            <span>${t`${"pixels_painted"}`}:</span>
            <span class="font-mono">${new Intl.NumberFormat().format(
              this.userData.pixelsPainted!,
            )}px</span>
          </div>
          <div class="mt-3">
            ${levelGaugeHtml}
          </div>
        </div>
      </div>
    `;
  }

  private createChargeSection(): string {
    return `
      <div class="mb-6">
        <h4 class="font-semibold text-md mb-3">⚡ ${t`${"charge_status"}`}</h4>
        <div id="charge-status-content">
          ${this.createChargeStatusContent()}
        </div>
      </div>
    `;
  }

  private createChargeStatusContent(): string {
    const { current, max, timeToFullMs } = this.getChargeData();
    const timeRemaining = this.calculator.formatTimeRemaining(timeToFullMs);

    const chargeGaugeHtml = this.calculator.generateChargeGaugeHtml(
      current,
      max,
    );

    const fullChargeTime = new Date(Date.now() + timeToFullMs);
    const formattedTime = this.formatMonthDayTime(fullChargeTime);

    const timeDisplay =
      timeToFullMs > 0
        ? `<div class="flex justify-between">
           <span>${t`${"time_to_full"}`}:</span>
           <span class="font-mono">${timeRemaining.replace("⚡ ", "")}</span>
         </div>
         <div class="flex justify-between">
           <span>${t`${"full_charge_at"}`}:</span>
           <span class="font-mono">${formattedTime}</span>
         </div>`
        : `<div class="flex justify-between text-green-600">
           <span class="font-semibold">${t`${"fully_charged"}`}</span>
         </div>`;

    return `
      <div class="space-y-2">
        ${timeDisplay}
        <div class="mt-3">
          ${chargeGaugeHtml}
        </div>
      </div>
    `;
  }

  private createAlarmStatusHTML(): string {
    if (this.currentAlarmInfo) {
      const alarmDate = new Date(this.currentAlarmInfo.scheduledTime);
      const alarmTime = this.formatMonthDayTime(alarmDate);
      return `
        <div style="background-color: #dcfce7; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #bbf7d0;">
          <div style="font-size: 13px; color: #15803d; font-weight: 500;">${t`${"alarm_active"}`}</div>
          <div style="font-size: 12px; color: #16a34a; margin-top: 2px;">${t`${"scheduled"}`}: ${alarmTime}</div>
        </div>
      `;
    }

    return `
      <div style="padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #d1d5db;">
        <div style="font-size: 13px; font-weight: 500;">${t`${"no_alarm_set"}`}</div>
      </div>
    `;
  }

  private createChargeMonitorLoadingSection(): string {
    return `
      <div id="alarm-section-container" class="mb-6 border-t pt-4" style="border-top: 1px solid #e5e7eb; margin-bottom: 24px; padding-top: 16px;">
        <h4 style="font-weight: 600; font-size: 16px; margin-bottom: 12px;">${t`${"charge_alarm"}`}</h4>
        <div style="display: flex; align-items: center; justify-content: center; padding: 24px;">
          <span>${t`${"loading_alarm_settings"}`}</span>
        </div>
      </div>
    `;
  }

  private createChargeMonitorSection(): string {
    const enableButtonDisplay = this.currentEnabledState
      ? "none"
      : "inline-block";
    const disableButtonDisplay = this.currentEnabledState
      ? "inline-block"
      : "none";

    const { current, max } = this.getChargeData();
    const thresholdPixels = Math.floor((max * this.currentThreshold) / 100);
    const thresholdTime = this.calculateThresholdTime(this.currentThreshold);
    const isThresholdReached = !this.calculateAlarmTime(this.currentThreshold);
    const shouldShowAppleButton = this.isAppleCalendarSupportedDevice();

    return `
      <div style="margin-bottom: 24px;">
        <h4 style="font-weight: 600; font-size: 16px; margin-bottom: 8px;">${t`${"charge_alarm"}`}</h4>
        <div style="font-size: 12px; margin-bottom: 12px;">
          ${t`${"alarm_browser_warning"}`}
        </div>

        <div style="margin-bottom: 16px;">
          <label style="font-size: 14px; font-weight: 500; display: block; margin-bottom: 8px;">
            ${t`${"notification_threshold"}`}: <span id="thresholdValue">${
              this.currentThreshold
            }</span>%
          </label>
          <input type="range" id="chargeThreshold" min="10" max="100" value="${
            this.currentThreshold
          }" step="5"
                 style="width: 100%; margin-bottom: 8px;">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
            <input type="number" id="thresholdInput" min="${Math.ceil(
              current,
            )}" max="${max}" value="${thresholdPixels}"
                   style="width: 80px; padding: 4px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-family: monospace; font-size: 13px;">
            <span style="font-size: 13px;">/ ${max}</span>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <div id="estimatedTime" style="flex: 1; font-size: 12px; padding: 6px 8px; border-radius: 4px; border: 1px solid #e5e7eb;">
              ${t`${"estimated_time"}`}: ${thresholdTime}
            </div>
            ${
              shouldShowAppleButton
                ? `<button id="addToAppleCalendar" style="background-color: white; color: #111827; padding: 6px 10px; border-radius: 4px; border: 1px solid #d1d5db; cursor: ${isThresholdReached ? "not-allowed" : "pointer"}; font-size: 12px; white-space: nowrap; opacity: ${isThresholdReached ? "0.5" : "1"};" ${isThresholdReached ? "disabled" : ""} title="Apple Calendar">
              Apple
            </button>`
                : ""
            }
            <button id="addToCalendar" style="background-color: ${isThresholdReached ? "#9ca3af" : "#3b82f6"}; color: white; padding: 6px 12px; border-radius: 4px; border: none; cursor: ${isThresholdReached ? "not-allowed" : "pointer"}; font-size: 12px; white-space: nowrap; opacity: ${isThresholdReached ? "0.5" : "1"};" ${isThresholdReached ? "disabled" : ""} title="${t`${"add_to_calendar_title"}`}">
              📅${t`${"add_to_calendar_title"}`}
            </button>
          </div>
        </div>

        <div id="alarm-status-content">
          ${this.createAlarmStatusHTML()}
        </div>

        <div style="display: flex; gap: 8px;">
          <button id="enableAlarm" style="background-color: #16a34a; color: white; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; display: ${enableButtonDisplay};">
            ${t`${"enable_alarm"}`}
          </button>
          <button id="disableAlarm" style="background-color: #dc2626; color: white; padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 500; display: ${disableButtonDisplay};">
            ${t`${"disable_alarm"}`}
          </button>
        </div>
      </div>
    `;
  }

  private setupChargeMonitorListeners(): void {
    const enableButton = document.getElementById("enableAlarm");
    const disableButton = document.getElementById("disableAlarm");
    const thresholdSlider = document.getElementById(
      "chargeThreshold",
    ) as HTMLInputElement;
    const thresholdValue = document.getElementById("thresholdValue");
    const thresholdInput = document.getElementById(
      "thresholdInput",
    ) as HTMLInputElement;
    const estimatedTime = document.getElementById("estimatedTime");
    const addToAppleCalendarButton =
      document.getElementById("addToAppleCalendar");
    const addToCalendarButton = document.getElementById("addToCalendar");

    if (!enableButton || !disableButton) return;

    enableButton.addEventListener("click", async () => {
      const threshold = this.currentThreshold;

      // thresholdとenabled状態をstorageに保存
      await storage.set({
        [NotificationModal.ALARM_THRESHOLD_KEY]: threshold,
        [NotificationModal.ALARM_ENABLED_STATE_KEY]: true,
      });

      // ボタン表示切り替え
      enableButton.style.display = "none";
      disableButton.style.display = "inline-block";

      const alarmTime = this.calculateAlarmTime(threshold);
      if (!alarmTime) {
        console.log("🧑‍🎨: Threshold already reached, alarm enabled but not set");
        return;
      }
      await runtime.sendMessage({
        type: "START_CHARGE_ALARM",
        when: alarmTime.getTime(),
      });
      console.log(
        "🧑‍🎨: Alarm enabled for threshold:",
        threshold,
        "at",
        alarmTime.toLocaleTimeString(),
      );
    });

    disableButton.addEventListener("click", async () => {
      // enabled状態をfalseに保存
      await storage.set({
        [NotificationModal.ALARM_ENABLED_STATE_KEY]: false,
      });

      // ボタン表示切り替え
      disableButton.style.display = "none";
      enableButton.style.display = "inline-block";

      await runtime.sendMessage({ type: "STOP_CHARGE_ALARM" });
      console.log("🧑‍🎨: Alarm disabled");
    });

    if (thresholdSlider && thresholdValue && estimatedTime && thresholdInput) {
      const updateThresholdDisplay = async (source: "slider" | "input") => {
        const { current, max } = this.getChargeData();
        let threshold: number;
        let pixels: number;

        if (source === "slider") {
          threshold = parseInt(thresholdSlider.value);
          pixels = Math.floor((max * threshold) / 100);
          thresholdInput.value = pixels.toString();
        } else {
          pixels = parseInt(thresholdInput.value);
          pixels = Math.max(Math.ceil(current), Math.min(max, pixels));
          thresholdInput.value = pixels.toString();
          threshold = Math.round((pixels / max) * 100);
          thresholdSlider.value = threshold.toString();
        }

        this.currentThreshold = threshold;
        thresholdValue.textContent = threshold.toString();
        const thresholdTime = this.calculateThresholdTime(threshold);
        estimatedTime.textContent = `${t`${"estimated_time"}`}: ${thresholdTime}`;

        this.updateCalendarButtonState();

        // storageに保存
        await storage.set({
          [NotificationModal.ALARM_THRESHOLD_KEY]: threshold,
        });

        // enable状態の場合のみアラーム更新
        const enabled = await this.getAlarmEnabledState();
        if (enabled) {
          const alarmTime = this.calculateAlarmTime(threshold);
          if (!alarmTime) {
            console.log("🧑‍🎨: Threshold reached, stopping alarm");
            await runtime.sendMessage({ type: "STOP_CHARGE_ALARM" });
            return;
          }
          await runtime.sendMessage({ type: "STOP_CHARGE_ALARM" });
          await runtime.sendMessage({
            type: "START_CHARGE_ALARM",
            when: alarmTime.getTime(),
          });
          console.log(
            "🧑‍🎨: Alarm updated for threshold:",
            threshold,
            "at",
            alarmTime.toLocaleTimeString(),
          );
        }
      };

      thresholdSlider.addEventListener("input", () =>
        updateThresholdDisplay("slider"),
      );
      thresholdInput.addEventListener("change", () =>
        updateThresholdDisplay("input"),
      );
    }

    if (addToAppleCalendarButton) {
      addToAppleCalendarButton.addEventListener("click", () => {
        const alarmTime = this.calculateAlarmTime(this.currentThreshold);
        if (alarmTime) {
          const calendarUrl = this.generateAppleCalendarLink(alarmTime);
          window.open(calendarUrl, "_blank");
        }
      });
    }

    if (addToCalendarButton) {
      addToCalendarButton.addEventListener("click", () => {
        const alarmTime = this.calculateAlarmTime(this.currentThreshold);
        if (alarmTime) {
          const calendarUrl = this.generateGoogleCalendarLink(alarmTime);
          window.open(calendarUrl, "_blank");
        }
      });
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
