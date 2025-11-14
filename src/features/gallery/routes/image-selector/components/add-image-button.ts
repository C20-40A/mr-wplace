/**
 * 画像追加ボタン作成
 */
export const createAddImageButton = (onAddClick: () => void): HTMLElement => {
  const container = document.createElement("div");
  container.className = "add-image-btn border-2 border-dashed border-base-300 rounded-lg";
  container.style.cssText = `
    cursor: pointer;
    transition: border-color 0.2s;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const content = document.createElement("div");
  content.className = "add-image-content text-base-content/40";
  content.style.cssText = `
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    transition: transform 0.2s, color 0.2s;
  `;
  content.textContent = "＋";

  container.onclick = onAddClick;

  container.appendChild(content);
  return container;
};
