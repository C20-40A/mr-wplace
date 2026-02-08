/**
 * Stats Bridge - Content ↔ Inject communication for statistics computation
 */

const statsUpdateQueue = new Map<string, Promise<void>>();

/**
 * Handle stats computation notification from inject side
 * Save computed stats to storage
 *
 * Note: Only saves stats for gallery images, not text layer
 */
export const handleStatsComputed = async (
  imageKey: string,
  tileStatsPayload:
    | Record<
        string,
        { matched: Record<string, number>; total: Record<string, number> }
      >
    | undefined
) => {
  // Skip temporary layers (text, snapshot)
  if (imageKey.startsWith("text_") || imageKey.startsWith("snapshot_")) return;
  if (!tileStatsPayload) return;

  const previousTask = statsUpdateQueue.get(imageKey) || Promise.resolve();
  const currentTask = previousTask
    .catch(() => undefined)
    .then(async () => {
      try {
        const { GalleryStorage } = await import("@/states/galleryStorage");
        const galleryStorage = new GalleryStorage();

        // Convert object back to Map
        const statsMap = new Map<
          string,
          { matched: Map<string, number>; total: Map<string, number> }
        >();
        for (const [tileKey, stats] of Object.entries(tileStatsPayload)) {
          statsMap.set(tileKey, {
            matched: new Map(
              Object.entries(stats.matched).map(([k, v]) => [k, v]),
            ),
            total: new Map(Object.entries(stats.total).map(([k, v]) => [k, v])),
          });
        }

        await galleryStorage.updateTileColorStats(imageKey, statsMap);
        console.log(`🧑‍🎨 : Saved stats for ${imageKey} to storage`);
      } catch (error) {
        console.error(`🧑‍🎨 : Failed to save stats for ${imageKey}:`, error);
      }
    });

  statsUpdateQueue.set(imageKey, currentTask);
  await currentTask;

  if (statsUpdateQueue.get(imageKey) === currentTask) {
    statsUpdateQueue.delete(imageKey);
  }
};

/**
 * Handle total stats computation notification from inject side
 * Save total stats only (for images without position)
 */
export const handleTotalStatsComputed = async (
  imageKey: string,
  totalColorStats: Record<string, number>
) => {
  try {
    // Skip temporary layers (text, snapshot)
    if (imageKey.startsWith("text_") || imageKey.startsWith("snapshot_"))
      return;

    const { GalleryStorage } = await import("@/states/galleryStorage");
    const galleryStorage = new GalleryStorage();

    const image = await galleryStorage.get(imageKey);
    if (!image) {
      console.warn(`🧑‍🎨 : Image not found for stats update: ${imageKey}`);
      return;
    }

    // Save total stats only
    await galleryStorage.save({
      ...image,
      totalColorStats,
    });

    console.log(`🧑‍🎨 : Saved total stats for ${imageKey} to storage`);
  } catch (error) {
    console.error(`🧑‍🎨 : Failed to save total stats for ${imageKey}:`, error);
  }
};
