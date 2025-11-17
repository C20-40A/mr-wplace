export const createAutoCanvasClickButton = (
  enabled: boolean
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-sm btn-circle btn-ghost";
  button.title = "Toggle auto canvas click";

  // Auto canvas click icon SVG
  button.innerHTML = `
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

  // ON/OFF状態で色を変更
  if (enabled) {
    button.classList.add("text-primary");
  } else {
    button.classList.add("text-base-content");
    button.style.opacity = "0.5";
  }

  return button;
};
