/**
 * User Modal Handler - Handle user modal messages from inject side
 */

import type { NotificationModal } from "@/features/user-status/ui/notification-modal";

/**
 * Setup user modal message handler
 */
export const setupUserModalHandler = (notificationModal: NotificationModal) => {
  return (event: MessageEvent) => {
    // User data is now handled directly in inject context
    // But we still handle modal open requests
    if (event.data.source !== "mr-wplace-open-user-modal") return;

    const userData = event.data.userData;
    notificationModal.show(userData);
  };
};
