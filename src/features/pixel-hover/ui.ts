/**
 * PixelHover機能のUIコンポーネント
 */

/**
 * PixelHover FAB (Floating Action Button) を作成
 */
export function createPixelHoverFAB(): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "block";
  button.style.cssText = `
    background-color: rgb(74 222 128);
    color: rgb(22 101 52);
    border-radius: 9999px;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  `;

  // アイコン: スポイト風（目のアイコン）
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `;

  // hover effect
  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "rgb(134 239 172)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "rgb(74 222 128)";
  });

  return button;
}

/**
 * PixelHover有効時の表示を更新
 */
export function updatePixelHoverFAB(
  button: HTMLButtonElement,
  enabled: boolean
): void {
  if (enabled) {
    // 有効時: 暗い緑
    button.style.backgroundColor = "rgb(22 163 74)";
    button.style.color = "rgb(240 253 244)";
  } else {
    // 無効時: 明るい緑
    button.style.backgroundColor = "rgb(74 222 128)";
    button.style.color = "rgb(22 101 52)";
  }
}
