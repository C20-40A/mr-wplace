/**
 * Bridge - Content ↔ Inject communication layer
 *
 * This module provides all communication functions between content script and inject script
 */

// Gallery
export {
  sendGalleryImagesToInject,
  requestTotalStatsComputation,
} from "./gallery-bridge";

// Settings
export {
  sendComputeDeviceToInject,
  sendCacheSizeToInject,
} from "./settings-bridge";

// Overlay
export {
  sendShowUnplacedOnlyToInject,
  sendSelectedColorOnlyMarkToInject,
  sendOverlayLightweightModeToInject,
  sendColorFilterToInject,
  sendDraftModeToInject,
  sendDraftEraseModeToInject,
  sendDraftBucketModeToInject,
  sendDraftBrushToInject,
  sendDraftMapLockToInject,
  requestDraftExport,
  requestDraftSeed,
} from "./overlay-bridge";

// Text
export { sendTextLayersToInject } from "./text-bridge";

// Stats
export {
  handleStatsComputed,
  handleTotalStatsComputed,
} from "./stats-bridge";
