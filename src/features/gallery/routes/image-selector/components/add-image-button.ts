/**
 * 画像追加ボタン作成
 */
export const createAddImageButton = (onAddClick: () => void): HTMLElement => {
  const container = document.createElement("div");
  container.style.cssText = `
    cursor: pointer;
    transition: all 0.2s;
    border-radius: 0.5rem;
    overflow: hidden;
    border: 2px dashed #e5e7eb;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    color: #9ca3af;
    transition: all 0.2s;
  `;
  content.textContent = "＋";

  container.onmouseenter = () => {
    content.style.transform = "scale(1.1)";
    content.style.color = "#6366f1";
    container.style.borderColor = "#6366f1";
  };
  container.onmouseleave = () => {
    content.style.transform = "scale(1)";
    content.style.color = "#9ca3af";
    container.style.borderColor = "#e5e7eb";
  };
  container.onclick = onAddClick;

  container.appendChild(content);
  return container;
};
