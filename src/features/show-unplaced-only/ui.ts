import { SHOW_UNPLACED_ONLY_ICON_SVG } from "@/assets/enhanced-mode-icons";

export const createShowUnplacedOnlyButton = (enabled: boolean): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = `btn btn-square btn-sm ${enabled ? "text-primary" : "text-base-content"}`;
  button.style.cssText = `
    opacity: ${enabled ? "1" : "0.5"};
    transition: opacity 0.2s ease;
  `;
  button.innerHTML = SHOW_UNPLACED_ONLY_ICON_SVG;
  return button;
};
