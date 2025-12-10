import {
  getOrCreateMapPinButtonGroup,
  createMapPinGroupButton,
} from "@/components/map-pin-button";

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
