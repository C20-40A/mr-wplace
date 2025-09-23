import { createModal, ModalElements } from "../../../utils/modal";
import { WPlaceUserData } from "../../../types/user-data";
import { StatusCalculator } from "../services/calculator";

export class NotificationModal {
  private calculator = new StatusCalculator();
  private modalElements?: ModalElements;
  private userData?: WPlaceUserData;

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
  }

  private renderContent(): void {
    if (!this.modalElements || !this.userData) return;

    const sections = [];

    if (this.userData.level !== undefined && this.userData.pixelsPainted !== undefined) {
      sections.push(this.createLevelSection());
    }

    if (this.userData.charges) {
      sections.push(this.createChargeSection());
    }

    this.modalElements.container.innerHTML = sections.join('');
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

  private createChargeSection(): string {
    if (!this.userData?.charges) return '';

    const timeData = this.calculator.calculateTimeToFull(this.userData.charges);
    const percentage = (timeData.current / timeData.max) * 100;

    return `
      <div class="mb-6">
        <h4 class="font-semibold text-md mb-3">⚡ Charge Status</h4>
        <div class="space-y-2">
          <div class="flex justify-between">
            <span>Current Charges:</span>
            <span class="font-mono">${timeData.current}/${timeData.max}</span>
          </div>
          <div class="flex justify-between">
            <span>Cooldown:</span>
            <span class="font-mono">${(timeData.cooldownMs / 1000)}s</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2 mt-3">
            <div class="bg-green-500 h-2 rounded-full transition-all duration-300" 
                 style="width: ${percentage}%"></div>
          </div>
        </div>
      </div>
    `;
  }

  destroy(): void {
    if (this.modalElements) {
      this.modalElements.modal.remove();
      this.modalElements = undefined;
    }
  }
}
