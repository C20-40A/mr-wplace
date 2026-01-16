interface DeveloperDialogElements {
  dialog: HTMLDivElement;
  content: HTMLDivElement;
  destroy: () => void;
}

let dialogInstance: DeveloperDialogElements | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

export const createDeveloperDialog = (): DeveloperDialogElements => {
  // 既存のダイアログがあれば再利用
  if (dialogInstance) return dialogInstance;

  const dialog = document.createElement("div");
  dialog.id = "mr-wplace-dev-dialog";
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 16px;
    transform: translateY(-50%);
    z-index: 9999;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0, 255, 136, 0.2);
    border-left: 2px solid rgba(0, 255, 136, 0.7);
    border-radius: 2px;
    padding: 10px 12px;
    min-width: 170px;
    box-shadow:
      0 0 20px rgba(0, 0, 0, 0.8),
      0 0 40px rgba(0, 255, 136, 0.05),
      inset 0 0 30px rgba(0, 0, 0, 0.4);
    display: none;
    cursor: default;
    user-select: none;
    font-family: 'Consolas', 'Monaco', monospace;
  `;

  // Header (drag handle + close button)
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    cursor: move;
    padding: 2px 0;
    border-bottom: 1px solid rgba(0, 255, 136, 0.1);
    padding-bottom: 6px;
  `;

  const title = document.createElement("span");
  title.style.cssText = `
    color: rgba(0, 255, 136, 1);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-shadow: 0 0 10px rgba(0, 255, 136, 0.6);
  `;
  title.textContent = "//DEV";

  const closeBtn = document.createElement("button");
  closeBtn.style.cssText = `
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 1px;
    transition: all 0.1s ease;
    width: 18px;
    height: 18px;
  `;
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 10px; height: 10px;">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  `;
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.color = "rgba(255, 100, 100, 0.9)";
    closeBtn.style.borderColor = "rgba(255, 100, 100, 0.4)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.color = "rgba(255, 255, 255, 0.4)";
    closeBtn.style.borderColor = "rgba(255, 255, 255, 0.15)";
  });
  closeBtn.addEventListener("click", () => hideDeveloperDialog());

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Content area
  const content = document.createElement("div");
  content.id = "mr-wplace-dev-dialog-content";
  content.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 8px;
  `;

  dialog.appendChild(header);
  dialog.appendChild(content);
  document.body.appendChild(dialog);

  // Drag handling
  const handleMouseDown = (e: MouseEvent) => {
    if (e.target === closeBtn || closeBtn.contains(e.target as Node)) return;
    isDragging = true;
    const rect = dialog.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dialog.style.cursor = "grabbing";
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.transform = "none";
  };

  const handleMouseUp = () => {
    isDragging = false;
    dialog.style.cursor = "default";
  };

  header.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // ESC to close
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && dialog.style.display !== "none") {
      hideDeveloperDialog();
    }
  };
  document.addEventListener("keydown", handleKeydown);

  const destroy = () => {
    header.removeEventListener("mousedown", handleMouseDown);
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("keydown", handleKeydown);
    dialog.remove();
    dialogInstance = null;
  };

  dialogInstance = { dialog, content, destroy };
  return dialogInstance;
};

export const showDeveloperDialog = (): void => {
  const { dialog } = createDeveloperDialog();
  dialog.style.display = "block";
};

export const hideDeveloperDialog = (): void => {
  if (dialogInstance) {
    dialogInstance.dialog.style.display = "none";
  }
};

export const toggleDeveloperDialog = (): void => {
  const { dialog } = createDeveloperDialog();
  if (dialog.style.display === "none") {
    dialog.style.display = "block";
  } else {
    dialog.style.display = "none";
  }
};

export const getDeveloperDialogContent = (): HTMLDivElement | null => {
  return dialogInstance?.content ?? null;
};
