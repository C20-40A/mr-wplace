export interface ResetAreasOptions {
  clearRegions: () => Promise<void>;
  clearGroups: () => Promise<void>;
  notifyAreaRegions: () => void;
  renderAreaManager?: () => void;
}

/**
 * Reset all area regions and groups
 */
export const resetAllAreas = async (
  options: ResetAreasOptions,
): Promise<void> => {
  const { clearRegions, clearGroups, notifyAreaRegions, renderAreaManager } =
    options;

  await clearRegions();
  await clearGroups();
  notifyAreaRegions();
  renderAreaManager?.();

  console.log("🧑‍🎨 : All areas have been reset");
};
