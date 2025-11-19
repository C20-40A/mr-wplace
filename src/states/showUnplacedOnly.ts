/**
 * Show unplaced only state management
 * Transient state (not persisted to storage, resets on page reload)
 */

let showUnplacedOnlyState = false;
const listeners: Set<(enabled: boolean) => void> = new Set();

export const getShowUnplacedOnly = (): boolean => {
  return showUnplacedOnlyState;
};

export const setShowUnplacedOnly = (enabled: boolean): void => {
  showUnplacedOnlyState = enabled;
  listeners.forEach((listener) => listener(enabled));
};

export const subscribeShowUnplacedOnly = (
  listener: (enabled: boolean) => void
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
