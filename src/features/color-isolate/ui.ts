import { t } from "../../i18n/manager";

export const createColorIsolateButton = (
  enabled: boolean
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-circle btn-ghost";
  button.title = "色を分離表示"; // TODO: i18n化

  // カラーフィルター分離アイコンSVG
  button.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- カラーパレット -->
      <rect x="3" y="4" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>

      <!-- パレット内の色サンプル（グリッド状） -->
      <rect x="5" y="6" width="3" height="3" fill="#E74C3C" opacity="0.3"/>
      <rect x="9" y="6" width="3" height="3" fill="#3498DB" opacity="0.3"/>
      <rect x="5" y="10" width="3" height="3" fill="#2ECC71" opacity="0.3"/>

      <!-- 選択中の色（強調表示） -->
      <rect x="9" y="10" width="3" height="3" fill="#F39C12" stroke="#F39C12" stroke-width="2"/>

      <!-- フィルター/虫眼鏡アイコン -->
      <circle cx="17" cy="17" r="3.5" stroke="currentColor" stroke-width="2" fill="none"/>
      <line x1="19.5" y1="19.5" x2="22" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>

      <!-- フィルターラインを虫眼鏡内に -->
      <line x1="15.5" y1="17" x2="18.5" y2="17" stroke="#F39C12" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  `;

  // ON/OFF状態で色を変更
  if (enabled) {
    button.classList.add("text-primary");
  } else {
    button.classList.add("text-base-content");
    button.style.opacity = "0.5";
  }

  return button;
};
