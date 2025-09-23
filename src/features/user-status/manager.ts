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

  private container: HTMLElement;
  private nextLevelBadge: HTMLElement;
  private chargeCountdown: HTMLElement;
  private notificationIcon: HTMLElement;
  private currentUserData?: WPlaceUserData;

  constructor() {
    this.container = this.uiComponents.createContainer();
    this.nextLevelBadge = this.uiComponents.createNextLevelBadge();
    this.chargeCountdown = this.uiComponents.createChargeCountdown();
    this.notificationIcon = this.uiComponents.createNotificationIcon();
    this.setupContainer();
    this.setupEventListeners();
    this.hideAll();
  }

  private setupContainer(): void {
    this.container.appendChild(this.notificationIcon);
    this.container.appendChild(this.chargeCountdown);
    this.container.appendChild(this.nextLevelBadge);
  }

  private setupEventListeners(): void {
    this.notificationIcon.addEventListener("click", () => {
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
    this.nextLevelBadge.style.display = "flex";
  }

  private showChargeCountdown(): void {
    this.chargeCountdown.style.display = "flex";
  }

  updateFromUserData(userData: WPlaceUserData): void {
    console.log("🧑‍🎨: StatusManager updating from userData");
    this.currentUserData = userData;

    if (userData.level !== undefined && userData.pixelsPainted !== undefined) {
      const remainingPixels = this.calculator.calculateNextLevelPixels(
        userData.level, 
        userData.pixelsPainted
      );

      if (remainingPixels > 0) {
        const badgeHtml = this.calculator.generateProgressGaugeHtml(
          remainingPixels, 
          userData.level
        );
        this.nextLevelBadge.innerHTML = badgeHtml;
        this.showNextLevelBadge();
      }
    }

    if (userData.charges) {
      this.timerService.startChargeCountdown(
        userData.charges,
        (timeText: string) => {
          this.chargeCountdown.textContent = timeText;
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
}
