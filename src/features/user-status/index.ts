import { setupElementObserver } from "../../components/element-observer";
import { StatusManager } from "./manager";

export class UserStatus {
  private statusManager: StatusManager;

  constructor() {
    this.statusManager = new StatusManager();
  }

  init(): boolean {
    setupElementObserver([
      {
        id: "user-status-container",
        getTargetElement: () => document.body,
        createElement: (body) => {
          if (!document.getElementById("user-status-container")) {
            body.appendChild(this.statusManager.getContainer());
          }
        },
      },
    ]);

    return true;
  }

  updateFromUserData(userData: any): void {
    this.statusManager.updateFromUserData(userData);
  }

  destroy(): void {
    this.statusManager.destroy();
  }
}
