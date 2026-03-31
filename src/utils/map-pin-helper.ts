import {
  getOrCreateMapPinButtonGroup,
  createMapPinGroupButton,
} from "@/components/map-pin-button";
import type { ElementConfig } from "@/components/element-observer";
import { findMapPin } from "@/constants/selectors";
import { showFeatureHint } from "@/features/feature-hints";

interface MapPinButtonConfig {
  id: string;
  icon?: string;
  iconSrc?: string;
  text: string;
  onClick: () => void;
}

/**
 * マップピングループにボタンを追加（重複チェック付き）
 */
export const addMapPinButton = (
  container: Element,
  config: MapPinButtonConfig
): HTMLButtonElement | null => {
  const group = getOrCreateMapPinButtonGroup(container);

  // 既存ボタンチェック
  if (group.querySelector(`#${config.id}`)) return null;

  const button = createMapPinGroupButton({
    icon: config.icon,
    iconSrc: config.iconSrc,
    text: config.text,
    onClick: config.onClick,
  });
  button.id = config.id;

  group.appendChild(button);
  console.log(`🧑‍🎨 : ${config.id} button added to group`);

  return button;
};

interface MapPinObserverConfig extends MapPinButtonConfig {
  observerId: string;
  hintId?: string;
}

export const createMapPinButtonObserverConfig = (
  config: MapPinObserverConfig
): ElementConfig => ({
  id: config.observerId,
  getTargetElement: findMapPin,
  createElement: (container) => {
    const button = addMapPinButton(container, config);
    if (button && config.hintId) showFeatureHint(config.hintId, button);
  },
});
