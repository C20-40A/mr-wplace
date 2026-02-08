/**
 * Stats Handler - Handle statistics-related messages from inject side
 */

import {
  handleStatsComputed,
  handleTotalStatsComputed,
} from "@/core/bridge/stats-bridge";

/**
 * Setup stats message handlers
 */
export const setupStatsHandlers = () => {
  return async (event: MessageEvent) => {
    // Listen for stats update from inject.js (after tile rendering)
    // This is called when a tile is rendered and statistics are computed
    // Statistics are saved to storage for persistence across reloads
    if (event.data.source === "mr-wplace-stats-updated") {
      const { imageKey, tileStatsDelta, tileStatsMap } = event.data;
      await handleStatsComputed(imageKey, tileStatsDelta || tileStatsMap);
      return;
    }

    // Listen for total stats computation from inject.js
    if (event.data.source === "mr-wplace-total-stats-computed") {
      const { imageKey, totalColorStats } = event.data;
      await handleTotalStatsComputed(imageKey, totalColorStats);
      return;
    }
  };
};
