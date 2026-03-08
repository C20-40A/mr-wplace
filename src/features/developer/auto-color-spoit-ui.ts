import { getColor, TEXT_COLORS, TEXT_OUTLINE } from "./ui-colors";

export const createAutoColorSpoitButton = (
  enabled: boolean,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-circle btn-ghost";
  button.title = "Toggle auto color spoit";

  // Eyedropper icon SVG
  button.innerHTML = `🪄`;

  // ON/OFF状態で色を変更
  if (enabled) {
    button.classList.add("text-primary");
  } else {
    button.classList.add("text-base-content");
    button.style.opacity = "0.5";
  }

  return button;
};

/** Dialog内用のコンパクトなUIアイテム */
export const createAutoColorSpoitDialogItem = (
  enabled: boolean,
  onClick: () => void,
): HTMLDivElement => {
  const item = document.createElement("div");
  item.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 4px;
    background: ${enabled ? getColor("primary", 0.15) : "rgba(255, 255, 255, 0.08)"};
    border: 1px solid ${enabled ? getColor("primary", 0.4) : "rgba(0, 0, 0, 0.1)"};
    cursor: pointer;
    transition: all 0.1s ease;
  `;
  item.addEventListener("mouseenter", () => {
    item.style.background = enabled
      ? getColor("primary", 0.2)
      : "rgba(255, 255, 255, 0.12)";
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = enabled
      ? getColor("primary", 0.15)
      : "rgba(255, 255, 255, 0.08)";
  });

  const icon = document.createElement("span");
  icon.style.cssText = `font-size: 14px; filter: ${enabled ? "none" : "grayscale(1) opacity(0.6)"};`;
  icon.textContent = "🪄";
  // icon.innerHTML = `
  //     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
  //     <path d="M7.5 5.6L10 7 8.6 4.5 10 2 7.5 3.4 5 2l1.4 2.5L5 7zm12 9.8L17 14l1.4 2.5L17 19l2.5-1.4L22 19l-1.4-2.5L22 14zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5zm-7.63 5.29c-.39-.39-1.02-.39-1.41 0L1.29 18.96c-.39.39-.39 1.02 0 1.41l2.34 2.34c.39.39 1.02.39 1.41 0L16.7 11.05c.39-.39.39-1.02 0-1.41l-2.33-2.35zm-1.03 5.49l-2.12-2.12 2.44-2.44 2.12 2.12-2.44 2.44z"/>
  //   </svg>`;

  const label = document.createElement("span");
  label.style.cssText = `
    color: ${enabled ? getColor("primary", 1) : TEXT_COLORS.primary};
    font-size: 11px;
    flex: 1;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 0.5px;
    text-shadow: ${TEXT_OUTLINE};
  `;
  label.textContent = "AUTO_SPOIT";

  const toggle = document.createElement("div");
  toggle.className = "auto-color-spoit-toggle";
  toggle.style.cssText = `
    width: 28px;
    height: 10px;
    border-radius: 5px;
    background: ${enabled ? getColor("primary", 1) : "rgba(0, 0, 0, 0.15)"};
    box-shadow: ${enabled ? `0 0 4px ${getColor("primary", 0.5)}` : "none"};
    transition: all 0.15s ease;
    position: relative;
  `;
  if (enabled) {
    toggle.innerHTML = `<span style="position:absolute;left:3px;top:1px;font-size:7px;color:#fff;font-weight:bold;font-family:monospace;">ON</span>`;
  } else {
    toggle.innerHTML = `<span style="position:absolute;right:2px;top:1px;font-size:7px;color:${TEXT_COLORS.tertiary};font-family:monospace;">OFF</span>`;
  }

  item.appendChild(icon);
  item.appendChild(label);
  item.appendChild(toggle);

  item.addEventListener("click", onClick);

  return item;
};

export const updateAutoColorSpoitDialogItem = (
  item: HTMLDivElement,
  enabled: boolean,
): void => {
  // Update item style
  item.style.background = enabled
    ? getColor("primary", 0.15)
    : "rgba(255, 255, 255, 0.08)";
  item.style.borderColor = enabled
    ? getColor("primary", 0.4)
    : "rgba(0, 0, 0, 0.1)";

  // Update icon
  const icon = item.querySelector("span:first-child") as HTMLSpanElement;
  if (icon) icon.style.filter = enabled ? "none" : "grayscale(1) opacity(0.6)";

  // Update label
  const label = item.querySelector("span:nth-child(2)") as HTMLSpanElement;
  if (label)
    label.style.color = enabled ? getColor("primary", 1) : TEXT_COLORS.primary;

  // Update toggle
  const toggle = item.querySelector(
    ".auto-color-spoit-toggle",
  ) as HTMLDivElement;
  if (toggle) {
    toggle.style.background = enabled
      ? getColor("primary", 1)
      : "rgba(0, 0, 0, 0.15)";
    toggle.style.boxShadow = enabled
      ? `0 0 4px ${getColor("primary", 0.5)}`
      : "none";
    toggle.innerHTML = enabled
      ? `<span style="position:absolute;left:3px;top:1px;font-size:7px;color:#fff;font-weight:bold;font-family:monospace;">ON</span>`
      : `<span style="position:absolute;right:2px;top:1px;font-size:7px;color:${TEXT_COLORS.tertiary};font-family:monospace;">OFF</span>`;
  }
};
