interface MapPinButtonConfig {
  icon: string;
  text: string;
  onClick: () => void;
  position: "top" | "right" | "bottom" | "left";
}

export const createMapPinButton = (
  config: MapPinButtonConfig
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "map-pin-button";

  // 固定サイズ＆中心不動
  button.style.cssText = `
    position: absolute;
    height: 2.75rem;
    min-width: 2.75rem;
    border-radius: 9999px;
    background: linear-gradient(145deg, #3b82f6, #1e40af);
    border: none;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: "Inter", sans-serif;
    user-select: none;
    padding: 0 0.5rem;
    z-index: 1000;
    backdrop-filter: blur(6px);
    transform-origin: center center;
    white-space: nowrap;
  `;

  // アイコン
  const iconSpan = document.createElement("span");
  iconSpan.textContent = config.icon;
  iconSpan.style.cssText = `
    font-size: 1.3rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.25s ease;
  `;

  // テキスト
  const textSpan = document.createElement("span");
  textSpan.textContent = config.text;
  textSpan.style.cssText = `
    font-size: 0.875rem;
    opacity: 0;
    max-width: 0;
    overflow: hidden;
    margin-left: 0;
    transition: all 0.3s ease;
  `;

  button.append(iconSpan, textSpan);

  // 位置
  const offset = "3.5rem";
  let baseTransform = "";
  switch (config.position) {
    case "top":
      button.style.bottom = offset;
      button.style.left = "50%";
      baseTransform = "translateX(-50%)";
      break;
    case "right":
      button.style.left = offset;
      button.style.top = "50%";
      baseTransform = "translateY(-50%)";
      break;
    case "bottom":
      button.style.top = offset;
      button.style.left = "50%";
      baseTransform = "translateX(-50%)";
      break;
    case "left":
      button.style.right = offset;
      button.style.top = "50%";
      baseTransform = "translateY(-50%)";
      break;
  }
  button.style.transform = baseTransform;

  // ホバー効果（位置不動・横伸び）
  button.addEventListener("mouseenter", () => {
    button.style.background = "linear-gradient(145deg, #2563eb, #1d4ed8)";
    button.style.transform = `${baseTransform} scale(1.05)`; // 中心基準で拡大
    textSpan.style.opacity = "1";
    textSpan.style.maxWidth = "200px";
    textSpan.style.marginLeft = "0.5rem";
    button.style.paddingRight = "1rem";
  });

  button.addEventListener("mouseleave", () => {
    button.style.background = "linear-gradient(145deg, #3b82f6, #1e40af)";
    button.style.transform = baseTransform;
    textSpan.style.opacity = "0";
    textSpan.style.maxWidth = "0";
    textSpan.style.marginLeft = "0";
    button.style.paddingRight = "0.5rem";
  });

  button.addEventListener("mousedown", () => {
    button.style.transform = `${baseTransform} scale(0.95)`;
    button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  });

  button.addEventListener("mouseup", () => {
    button.style.transform = `${baseTransform} scale(1.05)`;
    button.style.boxShadow = "0 4px 10px rgba(0,0,0,0.25)";
  });

  button.addEventListener("click", config.onClick);

  return button;
};

export const createMapPinButtonContainer = (): HTMLDivElement => {
  const container = document.createElement("div");
  container.className = "map-pin-button-container";
  container.style.cssText = `
    position: relative;
    width: 0;
    height: 0;
  `;
  return container;
};

/**
 * マップピン上部のボタングループを取得または作成
 */
export const getOrCreateMapPinButtonGroup = (pinContainer: Element): HTMLElement => {
  let group = pinContainer.querySelector("#map-pin-button-group") as HTMLElement;
  if (!group) {
    group = document.createElement("div");
    group.id = "map-pin-button-group";
    group.style.cssText = `
      position: absolute;
      bottom: 3.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 0.5rem;
      z-index: 1000;
      align-items: center;
    `;
    pinContainer.appendChild(group);
  }
  return group;
};

/**
 * グループ内で使用するボタンを作成
 */
export const createMapPinGroupButton = (config: {
  icon: string;
  text: string;
  onClick: () => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "map-pin-group-button";
  
  button.style.cssText = `
    height: 2.75rem;
    min-width: 2.75rem;
    border-radius: 9999px;
    background: linear-gradient(145deg, #3b82f6, #1e40af);
    border: none;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-family: "Inter", sans-serif;
    user-select: none;
    padding: 0 0.5rem;
    backdrop-filter: blur(6px);
    white-space: nowrap;
  `;

  const iconSpan = document.createElement("span");
  iconSpan.textContent = config.icon;
  iconSpan.style.cssText = `
    font-size: 1.3rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const textSpan = document.createElement("span");
  textSpan.textContent = config.text;
  textSpan.style.cssText = `
    font-size: 0.875rem;
    opacity: 0;
    max-width: 0;
    overflow: hidden;
    margin-left: 0;
    transition: all 0.3s ease;
  `;

  button.append(iconSpan, textSpan);

  // Hover effects
  button.addEventListener("mouseenter", () => {
    button.style.background = "linear-gradient(145deg, #2563eb, #1d4ed8)";
    button.style.transform = "scale(1.05)";
    textSpan.style.opacity = "1";
    textSpan.style.maxWidth = "200px";
    textSpan.style.marginLeft = "0.5rem";
    button.style.paddingRight = "1rem";
  });

  button.addEventListener("mouseleave", () => {
    button.style.background = "linear-gradient(145deg, #3b82f6, #1e40af)";
    button.style.transform = "scale(1)";
    textSpan.style.opacity = "0";
    textSpan.style.maxWidth = "0";
    textSpan.style.marginLeft = "0";
    button.style.paddingRight = "0.5rem";
  });

  button.addEventListener("mousedown", () => {
    button.style.transform = "scale(0.95)";
    button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
  });

  button.addEventListener("mouseup", () => {
    button.style.transform = "scale(1.05)";
    button.style.boxShadow = "0 4px 10px rgba(0,0,0,0.25)";
  });

  button.addEventListener("click", config.onClick);

  return button;
};
