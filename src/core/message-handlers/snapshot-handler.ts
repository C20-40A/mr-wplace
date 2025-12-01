/**
 * Snapshot Handler - Handle snapshot-related messages from inject side
 */

import type { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import { addCurrentTile } from "@/states/currentTile";

/**
 * Setup snapshot message handler
 */
export const setupSnapshotHandler = (tileSnapshot: TileSnapshot) => {
  return async (event: MessageEvent) => {
    if (event.data.source !== "wplace-studio-snapshot") return;

    const { tileBlob, tileX, tileY } = event.data;
    await tileSnapshot.saveTmpTile(tileX, tileY, tileBlob);

    // Record current tile for processing optimization
    addCurrentTile(tileX, tileY);
  };
};
