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
  icon.style.cssText = `font-size: 16px;`;
  icon.textContent = "🪄";

  const label = document.createElement("span");
  label.style.cssText = `
    color: rgba(255, 255, 255, 0.8);
    font-size: 12px;
    flex: 1;
  `;
  label.textContent = "Auto Spoit";

  const toggle = document.createElement("div");
  toggle.className = "auto-color-spoit-toggle";
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

export const updateAutoColorSpoitDialogItem = (
  item: HTMLDivElement,
  enabled: boolean
): void => {
  const toggle = item.querySelector(
    ".auto-color-spoit-toggle"
  ) as HTMLDivElement;
  if (toggle) {
    toggle.style.background = enabled
      ? "#22c55e"
      : "rgba(255, 255, 255, 0.3)";
  }
};
