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
    padding: 8px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.05);
    cursor: pointer;
    transition: background 0.15s ease;
  `;
  item.addEventListener("mouseenter", () => {
    item.style.background = "rgba(255, 255, 255, 0.1)";
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = "rgba(255, 255, 255, 0.05)";
  });

  const icon = document.createElement("span");
  icon.style.cssText = `
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.8);
  `;
  icon.innerHTML = AUTO_CANVAS_CLICK_ICON.replace('class="size-4.5"', 'style="width: 18px; height: 18px;"');

  const label = document.createElement("span");
  label.style.cssText = `
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    flex: 1;
  `;
  label.textContent = "Auto Click";

  const toggle = document.createElement("div");
  toggle.className = "auto-canvas-click-toggle";
  toggle.style.cssText = `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${enabled ? "#22c55e" : "rgba(255, 255, 255, 0.3)"};
    transition: background 0.15s ease;
  `;

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
  const toggle = item.querySelector(
    ".auto-canvas-click-toggle"
  ) as HTMLDivElement;
  if (toggle) {
    toggle.style.background = enabled
      ? "#22c55e"
      : "rgba(255, 255, 255, 0.3)";
  }
};
