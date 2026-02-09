import { getColor, TEXT_COLORS, TEXT_OUTLINE } from "./ui-colors";

const AUTO_CANVAS_CLICK_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4.5">
    <!-- 3x3グリッド -->
    <rect x="6" y="6" width="4" height="4" fill="currentColor"/>
    <rect x="10" y="6" width="4" height="4" fill="currentColor"/>
    <rect x="14" y="6" width="4" height="4" fill="currentColor"/>
    <rect x="6" y="10" width="4" height="4" fill="currentColor"/>
    <rect x="10" y="10" width="4" height="4" fill="#000000" opacity="0.5"/>
    <rect x="14" y="10" width="4" height="4" fill="currentColor"/>
    <rect x="6" y="14" width="4" height="4" fill="currentColor"/>
    <rect x="10" y="14" width="4" height="4" fill="currentColor"/>
    <rect x="14" y="14" width="4" height="4" fill="currentColor"/>

    <!-- マウスカーソル（右下） -->
    <path d="M 16 15 L 16 21 L 18 19 L 19.5 22 L 21 21 L 19.5 18 L 22 18 Z" fill="#ffffff" stroke="#000000" stroke-width="0.5"/>
  </svg>
`;

export const createAutoCanvasClickButton = (
  enabled: boolean
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-circle btn-ghost";
  button.title = "Toggle auto canvas click";

  button.innerHTML = AUTO_CANVAS_CLICK_ICON;

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
export const createAutoCanvasClickDialogItem = (
  enabled: boolean,
  onClick: () => void
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
    item.style.background = enabled ? getColor("primary", 0.2) : "rgba(255, 255, 255, 0.12)";
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = enabled ? getColor("primary", 0.15) : "rgba(255, 255, 255, 0.08)";
  });

  const icon = document.createElement("span");
  icon.style.cssText = `
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${enabled ? getColor("primary", 1) : TEXT_COLORS.secondary};
  `;
  icon.innerHTML = AUTO_CANVAS_CLICK_ICON.replace('class="size-4.5"', 'style="width: 16px; height: 16px;"');

  const label = document.createElement("span");
  label.style.cssText = `
    color: ${enabled ? getColor("primary", 1) : TEXT_COLORS.primary};
    font-size: 11px;
    flex: 1;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 0.5px;
    text-shadow: ${TEXT_OUTLINE};
  `;
  label.textContent = "AUTO_CLICK";

  const toggle = document.createElement("div");
  toggle.className = "auto-canvas-click-toggle";
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

export const updateAutoCanvasClickDialogItem = (
  item: HTMLDivElement,
  enabled: boolean
): void => {
  // Update item style
  item.style.background = enabled ? getColor("primary", 0.15) : "rgba(255, 255, 255, 0.08)";
  item.style.borderColor = enabled ? getColor("primary", 0.4) : "rgba(0, 0, 0, 0.1)";

  // Update icon
  const icon = item.querySelector("span:first-child") as HTMLSpanElement;
  if (icon) icon.style.color = enabled ? getColor("primary", 1) : TEXT_COLORS.secondary;

  // Update label
  const label = item.querySelector("span:nth-child(2)") as HTMLSpanElement;
  if (label) label.style.color = enabled ? getColor("primary", 1) : TEXT_COLORS.primary;

  // Update toggle
  const toggle = item.querySelector(".auto-canvas-click-toggle") as HTMLDivElement;
  if (toggle) {
    toggle.style.background = enabled ? getColor("primary", 1) : "rgba(0, 0, 0, 0.15)";
    toggle.style.boxShadow = enabled ? `0 0 4px ${getColor("primary", 0.5)}` : "none";
    toggle.innerHTML = enabled
      ? `<span style="position:absolute;left:3px;top:1px;font-size:7px;color:#fff;font-weight:bold;font-family:monospace;">ON</span>`
      : `<span style="position:absolute;right:2px;top:1px;font-size:7px;color:${TEXT_COLORS.tertiary};font-family:monospace;">OFF</span>`;
  }
};
