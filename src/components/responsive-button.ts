/**
 * レスポンシブボタン作成
 * 小画面: アイコンのみ
 * 大画面: アイコン + テキスト
 */

interface ResponsiveButtonConfig {
  iconSrc?: string; // 画像URL (IMG_ICON_*)
  iconText?: string; // 絵文字テキスト
  text: string; // ボタンテキスト
  dataAttribute: string; // data-wplace-* 属性値
  altText: string; // 画像のalt属性
}

export const createResponsiveButton = (
  config: ResponsiveButtonConfig
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-primary";
  button.style.cssText = "margin: 0.5rem; padding: 0.375rem 0.5rem;";
  button.setAttribute(`data-wplace-${config.dataAttribute}`, "true");

  // アイコン作成
  let iconElement: HTMLElement;
  if (config.iconSrc) {
    const img = document.createElement("img");
    img.src = config.iconSrc;
    img.alt = config.altText;
    img.style.imageRendering = "pixelated";
    iconElement = img;
  } else if (config.iconText) {
    const span = document.createElement("span");
    span.textContent = config.iconText;
    iconElement = span;
  } else {
    throw new Error("iconSrc or iconText is required");
  }

  // テキスト作成
  const textElement = document.createElement("span");
  textElement.textContent = config.text;
  textElement.style.cssText =
    "display: none; font-size: 0.875rem; margin-left: 0.25rem;";

  // レスポンシブ対応
  const mediaQuery = window.matchMedia("(min-width: 640px)");
  const updateResponsive = () => {
    const isLargeScreen = mediaQuery.matches;
    textElement.style.display = isLargeScreen ? "inline" : "none";
    
    // アイコンサイズ変更
    if (config.iconSrc) {
      const img = iconElement as HTMLImageElement;
      if (isLargeScreen) {
        img.style.width = "1.4rem";
        img.style.height = "1.5rem";
      } else {
        img.style.width = "2rem";
        img.style.height = "2rem";
      }
    } else if (config.iconText) {
      const span = iconElement as HTMLSpanElement;
      span.style.fontSize = isLargeScreen ? "1.2rem" : "1.5rem";
    }
  };
  updateResponsive();
  mediaQuery.addEventListener("change", updateResponsive);

  button.appendChild(iconElement);
  button.appendChild(textElement);

  return button;
};
