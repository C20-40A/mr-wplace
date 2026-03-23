/**
 * Handle user status updates from /me endpoint
 * This runs in inject (page) context and updates window.mrWplace directly
 */

import { WplaceUserData } from "../types";
import { statusManagerSingleton } from "../features/user-status/status-manager";

export const handleUserStatusUpdate = (userData: WplaceUserData): void => {
  // Initialize status manager if not exists
  initStatusManager();

  // Update from user data
  statusManagerSingleton.updateFromUserData(userData);

  // Forward favorite locations to content script
  if (userData.favoriteLocations) {
    window.postMessage(
      {
        source: "mr-wplace-favorite-locations",
        favoriteLocations: userData.favoriteLocations,
      },
      "*"
    );
  }
};

const initStatusManager = (): void => {
  // Wait for body to be available
  const appendContainer = () => {
    if (document.body) {
      document.body.appendChild(statusManagerSingleton.getContainer());
      console.log("🧑‍🎨: User status container created");
    } else {
      setTimeout(appendContainer, 100); // Retry after 100ms
    }
  };
  appendContainer();
};
