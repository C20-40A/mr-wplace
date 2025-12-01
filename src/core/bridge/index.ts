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

// Layer
export { saveLayerToIndexedDB } from "./layer-bridge";

// Settings
export {
  sendComputeDeviceToInject,
  sendCacheSizeToInject,
} from "./settings-bridge";

// Overlay
export {
  sendShowUnplacedOnlyToInject,
  sendColorFilterToInject,
} from "./overlay-bridge";

// Text
export {
  sendTextLayersToInject,
  sendTileBoundariesToInject,
} from "./text-bridge";

// Stats
export {
  handleStatsComputed,
  handleTotalStatsComputed,
} from "./stats-bridge";
