import { sendColorFilterToInject } from "@/core/bridge/overlay-bridge";
import { ColorFilter } from "@/features/color-filter";
import type { EnhancedMode } from "@/types/image";

const getManager = () => window.mrWplace?.colorFilterManager ?? null;

const syncToInject = (): void => {
  const mgr = getManager();
  if (!mgr) return;
  sendColorFilterToInject(mgr);
  ColorFilter.getInstance()?.refreshFABBadge();
};

export const applySelectedColors = async (
  colorIds: number[],
): Promise<void> => {
  const mgr = getManager();
  if (!mgr) return;
  await mgr.setSelectedColors(colorIds);
  syncToInject();
};

export const applyEnhancedMode = (mode: EnhancedMode): void => {
  const mgr = getManager();
  if (!mgr) return;
  mgr.setEnhancedMode(mode);
  syncToInject();
};

export const applyEnhancedColor = (
  color: [number, number, number],
): void => {
  const mgr = getManager();
  if (!mgr) return;
  mgr.setEnhancedColor(color);
  syncToInject();
};
