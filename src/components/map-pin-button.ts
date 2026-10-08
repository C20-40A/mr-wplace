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

const GROUP_STYLE_ID = "map-pin-button-group-style";

// wplace新UI (daisyUI) のテーマ変数に追従 + 出現/クリックのマイクロインタラクション
const ensureGroupStyles = () => {
  if (document.getElementById(GROUP_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = GROUP_STYLE_ID;
  style.textContent = `
    #map-pin-button-group{position:absolute;bottom:2.8rem;left:50%;transform:translateX(-50%);display:flex;gap:0.5rem;z-index:1000;align-items:center;}
    .map-pin-group-button{--i:0;height:2.75rem;min-width:2.75rem;padding:0 0.55rem;border-radius:9999px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;white-space:nowrap;overflow:hidden;
      background:var(--color-base-100,#fff);color:var(--color-base-content,#222);border:2px solid var(--color-base-300,rgba(0,0,0,0.12));box-shadow:0 4px 12px rgba(0,0,0,0.22);
      transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,border-color .2s,background .2s,padding .3s ease;
      animation:mpg-pop .55s cubic-bezier(.34,1.56,.64,1) calc(var(--i) * 70ms) backwards;}
    .map-pin-group-button .mpg-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:1.5rem;height:1.5rem;font-size:1.3rem;transition:transform .35s cubic-bezier(.34,1.56,.64,1);}
    .map-pin-group-button .mpg-icon img{image-rendering:pixelated;width:100%;height:100%;object-fit:contain;}
    .map-pin-group-button .mpg-text{font-size:0.875rem;font-weight:600;opacity:0;max-width:0;overflow:hidden;margin-left:0;transition:all .3s ease;}
    .map-pin-group-button:hover{transform:translateY(-3px) scale(1.06);border-color:var(--color-primary,#3b82f6);box-shadow:0 8px 18px rgba(0,0,0,0.26);padding-right:1rem;}
    .map-pin-group-button:hover .mpg-icon{transform:rotate(-12deg) scale(1.15);}
    .map-pin-group-button:hover .mpg-text{opacity:1;max-width:200px;margin-left:0.5rem;}
    .map-pin-group-button:active{transform:scale(0.9);box-shadow:0 2px 6px rgba(0,0,0,0.3);transition-duration:.08s;}
    /* pop を同じindexに残すことで、squish解除時にpopが再生されない */
    .map-pin-group-button.mpg-squish{animation:mpg-pop .55s cubic-bezier(.34,1.56,.64,1) calc(var(--i) * 70ms) backwards,mpg-squish .45s cubic-bezier(.34,1.56,.64,1);}
    @keyframes mpg-pop{
      0%{opacity:0;transform:translateY(14px) scale(0.3) rotate(-25deg);}
      60%{opacity:1;transform:translateY(-4px) scale(1.12) rotate(6deg);}
      80%{transform:translateY(1px) scale(0.96) rotate(-2deg);}
      100%{opacity:1;transform:none;}
    }
    @keyframes mpg-squish{
      0%{transform:scale(1);}
      30%{transform:scale(1.18,0.82);}
      55%{transform:scale(0.9,1.12);}
      75%{transform:scale(1.05,0.96);}
      100%{transform:scale(1);}
    }
    @media (prefers-reduced-motion: reduce){.map-pin-group-button,.map-pin-group-button .mpg-icon{animation:none;transition:none;}}
  `;
  document.head.appendChild(style);
};

/**
 * マップピン上部のボタングループを取得または作成
 */
export const getOrCreateMapPinButtonGroup = (
  pinContainer: Element
): HTMLElement => {
  ensureGroupStyles();
  let group = pinContainer.querySelector(
    "#map-pin-button-group"
  ) as HTMLElement;
  if (!group) {
    group = document.createElement("div");
    group.id = "map-pin-button-group";
    pinContainer.appendChild(group);
  }
  return group;
};

/**
 * グループ内で使用するボタンを作成
 */
export const createMapPinGroupButton = (config: {
  icon?: string; // 絵文字アイコン（オプション）
  iconSrc?: string; // 画像アイコンURL（オプション）
  text: string;
  onClick: () => void;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "map-pin-group-button";

  const iconContainer = document.createElement("span");
  iconContainer.className = "mpg-icon";
  if (config.iconSrc) {
    const img = document.createElement("img");
    img.src = config.iconSrc;
    img.alt = config.text;
    iconContainer.appendChild(img);
  } else if (config.icon) {
    iconContainer.textContent = config.icon;
  }

  const textSpan = document.createElement("span");
  textSpan.className = "mpg-text";
  textSpan.textContent = config.text;

  button.append(iconContainer, textSpan);

  button.addEventListener("animationend", (e) => {
    if (e.animationName === "mpg-squish") button.classList.remove("mpg-squish");
  });

  button.addEventListener("click", (e) => {
    // NOTE: これがないと、Buttonクリックした位置にpinが移動してしまう
    e.stopPropagation(); // イベントの伝播を停止
    e.preventDefault(); // 標準の動作をキャンセル (念のため)
    // 連打でも毎回再生されるようにreflowを挟む
    button.classList.remove("mpg-squish");
    void button.offsetWidth;
    button.classList.add("mpg-squish");
    config.onClick();
  });

  return button;
};
