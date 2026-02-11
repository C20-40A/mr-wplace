/**
 * State version tracker for front tile layer cache busting
 * Increments version when any overlay-related state changes
 */

let stateVersion = 0;

/**
 * Increment state version to invalidate tile cache
 * This is called whenever overlay state changes (color filter, gallery, etc.)
 */
export const incrementStateVersion = (): number => {
  stateVersion++;
  console.log("🧑‍🎨 : Front tile layer state version incremented:", stateVersion);
  return stateVersion;
};

/**
 * Get current state version
 */
export const getStateVersion = (): number => {
  return stateVersion;
};

/**
 * Reset state version (for testing purposes)
 */
export const resetStateVersion = (): void => {
  stateVersion = 0;
  console.log("🧑‍🎨 : Front tile layer state version reset");
};
