/**
 * レスポンシブボタン作成
 * 小画面: アイコンのみ
 * 大画面: アイコン + テキスト
 */

interface ResponsiveButtonConfig {
  iconSrc?: string;          // 画像URL (IMG_ICON_*)
  iconText?: string;         // 絵文字テキスト
  text: string;              // ボタンテキスト
  dataAttribute: string;     // data-wplace-* 属性値
  altText: string;           // 画像のalt属性
}

export const createResponsiveButton = (config: ResponsiveButtonConfig): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-primary";
  button.style.cssText = "margin: 0.25rem; padding: 0.375rem 0.5rem;";
  button.setAttribute(`data-wplace-${config.dataAttribute}`, "true");

  // アイコン作成
  let iconElement: HTMLElement;
  if (config.iconSrc) {
    const img = document.createElement("img");
    img.src = config.iconSrc;
    img.alt = config.altText;
    img.style.cssText = "image-rendering: pixelated; width: 1.125rem; height: 1.125rem;";
    iconElement = img;
  } else if (config.iconText) {
    const span = document.createElement("span");
    span.textContent = config.iconText;
    span.style.cssText = "font-size: 1.125rem;";
    iconElement = span;
  } else {
    throw new Error("iconSrc or iconText is required");
  }

  // テキスト作成
  const textElement = document.createElement("span");
  textElement.textContent = config.text;
  textElement.style.cssText = "display: none; font-size: 0.875rem; margin-left: 0.25rem;";

  // レスポンシブ対応
  const mediaQuery = window.matchMedia("(min-width: 640px)");
  const updateTextVisibility = () => {
    textElement.style.display = mediaQuery.matches ? "inline" : "none";
  };
  updateTextVisibility();
  mediaQuery.addEventListener("change", updateTextVisibility);

  button.appendChild(iconElement);
  button.appendChild(textElement);

  return button;
};
