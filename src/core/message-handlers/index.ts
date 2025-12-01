/**
 * Message Handlers - Setup all window message listeners for inject ↔ content communication
 */

import type { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import type { NotificationModal } from "@/features/user-status/ui/notification-modal";
import { setupSnapshotHandler } from "./snapshot-handler";
import { setupStatsHandlers } from "./stats-handler";
import { setupPixelClickHandler } from "./pixel-click-handler";
import { setupUserModalHandler } from "./user-modal-handler";

/**
 * Setup all message listeners from inject side
 */
export const setupMessageHandlers = (
  tileSnapshot: TileSnapshot,
  notificationModal: NotificationModal
) => {
  const snapshotHandler = setupSnapshotHandler(tileSnapshot);
  const statsHandlers = setupStatsHandlers();
  const pixelClickHandler = setupPixelClickHandler();
  const userModalHandler = setupUserModalHandler(notificationModal);

  window.addEventListener("message", async (event) => {
    // Run all handlers (each checks its own source)
    await Promise.all([
      snapshotHandler(event),
      statsHandlers(event),
      pixelClickHandler(event),
      userModalHandler(event),
    ]);
  });

  console.log("🧑‍🎨 : Message handlers setup complete");
};
