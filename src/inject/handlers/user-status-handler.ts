/**
 * Handle user status updates from /me endpoint
 * This runs in inject (page) context and updates window.mrWplace directly
 */

import { StatusManager } from "../user-status/status-manager";

interface UserData {
  level?: number;
  pixelsPainted?: number;
  charges?: {
    count: number;
    max: number;
    cooldownMs: number;
  };
  extraColorsBitmap?: number;
}

let statusManager: StatusManager | null = null;

const initStatusManager = (): void => {
  if (statusManager) return;

  statusManager = new StatusManager();

  // Wait for body to be available
  const appendContainer = () => {
    if (document.body) {
      document.body.appendChild(statusManager!.getContainer());
      console.log("🧑‍🎨: User status container created");
    } else {
      setTimeout(appendContainer, 100);
    }
  };
  appendContainer();
};

export const handleUserStatusUpdate = (userData: UserData): void => {
  console.log("🧑‍🎨: Handling user status update in inject context:", userData);

  // Initialize status manager if not exists
  initStatusManager();

  if (!statusManager) {
    console.error("🧑‍🎨: StatusManager not initialized");
    return;
  }

  // Update from user data
  statusManager.updateFromUserData(userData);
};
