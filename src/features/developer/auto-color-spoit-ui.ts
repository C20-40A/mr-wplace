import { getColor } from "./ui-colors";

export const createAutoColorSpoitButton = (
  enabled: boolean
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
  onClick: () => void
): HTMLDivElement => {
  const item = document.createElement("div");
  item.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: 1px;
    background: ${enabled ? getColor("primary", 0.1) : "rgba(255, 255, 255, 0.04)"};
    border: 1px solid ${enabled ? getColor("primary", 0.3) : "rgba(255, 255, 255, 0.08)"};
    cursor: pointer;
    transition: all 0.1s ease;
  `;
  item.addEventListener("mouseenter", () => {
    item.style.background = enabled ? getColor("primary", 0.15) : "rgba(255, 255, 255, 0.08)";
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = enabled ? getColor("primary", 0.1) : "rgba(255, 255, 255, 0.04)";
  });

  const icon = document.createElement("span");
  icon.style.cssText = `font-size: 14px; filter: ${enabled ? "none" : "grayscale(1) opacity(0.6)"};`;
  icon.textContent = "🪄";

  const label = document.createElement("span");
  label.style.cssText = `
    color: ${enabled ? getColor("primary", 1) : "rgba(255, 255, 255, 0.7)"};
    font-size: 11px;
    flex: 1;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 0.5px;
  `;
  label.textContent = "AUTO_SPOIT";

  const toggle = document.createElement("div");
  toggle.className = "auto-color-spoit-toggle";
  toggle.style.cssText = `
    width: 28px;
    height: 10px;
    border-radius: 1px;
    background: ${enabled ? getColor("primary", 0.9) : "rgba(255, 255, 255, 0.15)"};
    box-shadow: ${enabled ? `0 0 8px ${getColor("primary", 0.6)}` : "none"};
    transition: all 0.15s ease;
    position: relative;
  `;
  if (enabled) {
    toggle.innerHTML = `<span style="position:absolute;left:3px;top:1px;font-size:7px;color:#000;font-weight:bold;font-family:monospace;">ON</span>`;
  } else {
    toggle.innerHTML = `<span style="position:absolute;right:2px;top:1px;font-size:7px;color:rgba(255,255,255,0.4);font-family:monospace;">OFF</span>`;
  }

  item.appendChild(icon);
  item.appendChild(label);
  item.appendChild(toggle);

  item.addEventListener("click", onClick);

  return item;
};

export const updateAutoColorSpoitDialogItem = (
  item: HTMLDivElement,
  enabled: boolean
): void => {
  // Update item style
  item.style.background = enabled ? getColor("primary", 0.1) : "rgba(255, 255, 255, 0.04)";
  item.style.borderColor = enabled ? getColor("primary", 0.3) : "rgba(255, 255, 255, 0.08)";

  // Update icon
  const icon = item.querySelector("span:first-child") as HTMLSpanElement;
  if (icon) icon.style.filter = enabled ? "none" : "grayscale(1) opacity(0.6)";

  // Update label
  const label = item.querySelector("span:nth-child(2)") as HTMLSpanElement;
  if (label) label.style.color = enabled ? getColor("primary", 1) : "rgba(255, 255, 255, 0.7)";

  // Update toggle
  const toggle = item.querySelector(".auto-color-spoit-toggle") as HTMLDivElement;
  if (toggle) {
    toggle.style.background = enabled ? getColor("primary", 0.9) : "rgba(255, 255, 255, 0.15)";
    toggle.style.boxShadow = enabled ? `0 0 8px ${getColor("primary", 0.6)}` : "none";
    toggle.innerHTML = enabled
      ? `<span style="position:absolute;left:3px;top:1px;font-size:7px;color:#000;font-weight:bold;font-family:monospace;">ON</span>`
      : `<span style="position:absolute;right:2px;top:1px;font-size:7px;color:rgba(255,255,255,0.4);font-family:monospace;">OFF</span>`;
  }
};
