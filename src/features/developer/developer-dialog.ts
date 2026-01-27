import { getColor } from "./ui-colors";

interface DeveloperDialogElements {
  dialog: HTMLDivElement;
  content: HTMLDivElement;
  destroy: () => void;
}

let dialogInstance: DeveloperDialogElements | null = null;
let onHideCallback: (() => void) | null = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let isMinimized = false;

export const createDeveloperDialog = (): DeveloperDialogElements => {
  // 既存のダイアログがあれば再利用
  if (dialogInstance) return dialogInstance;

  // 最小化状態を復元
  const savedMinimized = localStorage.getItem("mr-wplace-dev-minimized");
  isMinimized = savedMinimized === "true";

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
    border: 1px solid ${getColor("primary", 0.2)};
    border-left: 2px solid ${getColor("primary", 0.7)};
    border-radius: 2px;
    padding: 10px 12px;
    min-width: 170px;
    box-shadow:
      0 0 20px rgba(0, 0, 0, 0.8),
      0 0 40px ${getColor("primary", 0.05)},
      inset 0 0 30px rgba(0, 0, 0, 0.4);
    display: none;
    cursor: default;
    user-select: none;
    font-family: 'Consolas', 'Monaco', monospace;
  `;

  // Header (drag handle + buttons)
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    cursor: move;
    padding: 2px 0;
    border-bottom: 1px solid ${getColor("primary", 0.1)};
    padding-bottom: 6px;
    touch-action: none;
  `;

  const titleWrapper = document.createElement("div");
  titleWrapper.style.cssText = `display: flex; flex-direction: column; gap: 4px;`;

  const title = document.createElement("span");
  title.style.cssText = `
    color: ${getColor("primary", 1)};
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    text-shadow: 0 0 10px ${getColor("primary", 0.6)};
  `;
  title.textContent = "//DEV";

  const warning = document.createElement("span");
  warning.style.cssText = `
    color: rgba(255, 255, 255, 0.4);
    font-size: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    line-height: 1.2;
    max-width: 150px;
    display: ${isMinimized ? "none" : "block"};
  `;
  warning.textContent =
    "This is a private feature for development testing only. Not intended for actual use.";

  titleWrapper.appendChild(title);
  titleWrapper.appendChild(warning);

  // Button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = `display: flex; gap: 4px; align-items: center;`;

  // Minimize button
  const minimizeBtn = document.createElement("button");
  minimizeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.05);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    transition: all 0.15s ease;
    width: 22px;
    height: 22px;
  `;
  const updateMinimizeIcon = () => {
    minimizeBtn.innerHTML = isMinimized
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 12px; height: 12px;">
          <path fill-rule="evenodd" d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z" clip-rule="evenodd" />
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 12px; height: 12px;">
          <path d="M6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" />
        </svg>`;
  };
  updateMinimizeIcon();
  minimizeBtn.addEventListener("mouseenter", () => {
    minimizeBtn.style.color = "rgba(100, 200, 255, 0.9)";
    minimizeBtn.style.borderColor = "rgba(100, 200, 255, 0.5)";
    minimizeBtn.style.background = "rgba(100, 200, 255, 0.1)";
  });
  minimizeBtn.addEventListener("mouseleave", () => {
    minimizeBtn.style.color = "rgba(255, 255, 255, 0.5)";
    minimizeBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
    minimizeBtn.style.background = "rgba(255, 255, 255, 0.05)";
  });
  minimizeBtn.addEventListener("mousedown", () => {
    minimizeBtn.style.transform = "scale(0.95)";
  });
  minimizeBtn.addEventListener("mouseup", () => {
    minimizeBtn.style.transform = "scale(1)";
  });
  minimizeBtn.addEventListener("click", () => {
    isMinimized = !isMinimized;
    localStorage.setItem("mr-wplace-dev-minimized", String(isMinimized));
    const currentContent = document.getElementById("mr-wplace-dev-dialog-content") as HTMLDivElement;
    if (currentContent) {
      currentContent.style.display = isMinimized ? "none" : "flex";
    }
    warning.style.display = isMinimized ? "none" : "block";
    header.style.marginBottom = isMinimized ? "0" : "8px";
    header.style.borderBottom = isMinimized ? "none" : `1px solid ${getColor("primary", 0.1)}`;
    updateMinimizeIcon();
  });

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.05);
    border: 1.5px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    transition: all 0.15s ease;
    width: 22px;
    height: 22px;
  `;
  closeBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" style="width: 12px; height: 12px;">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  `;
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.color = "rgba(255, 100, 100, 0.9)";
    closeBtn.style.borderColor = "rgba(255, 100, 100, 0.5)";
    closeBtn.style.background = "rgba(255, 100, 100, 0.1)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.color = "rgba(255, 255, 255, 0.5)";
    closeBtn.style.borderColor = "rgba(255, 255, 255, 0.2)";
    closeBtn.style.background = "rgba(255, 255, 255, 0.05)";
  });
  closeBtn.addEventListener("mousedown", () => {
    closeBtn.style.transform = "scale(0.95)";
  });
  closeBtn.addEventListener("mouseup", () => {
    closeBtn.style.transform = "scale(1)";
  });
  closeBtn.addEventListener("click", () => hideDeveloperDialog());

  buttonContainer.appendChild(minimizeBtn);
  buttonContainer.appendChild(closeBtn);

  header.appendChild(titleWrapper);
  header.appendChild(buttonContainer);

  // Content area
  const content = document.createElement("div");
  content.id = "mr-wplace-dev-dialog-content";
  content.style.cssText = `
    display: ${isMinimized ? "none" : "flex"};
    flex-direction: column;
    gap: 8px;
  `;

  // 最小化状態をヘッダーに反映
  if (isMinimized) {
    header.style.marginBottom = "0";
    header.style.borderBottom = "none";
  }

  dialog.appendChild(header);
  dialog.appendChild(content);
  document.body.appendChild(dialog);

  // Drag handling (mouse & touch)
  const startDrag = (clientX: number, clientY: number) => {
    isDragging = true;
    const rect = dialog.getBoundingClientRect();
    dragOffset = { x: clientX - rect.left, y: clientY - rect.top };
    dialog.style.cursor = "grabbing";
    header.style.cursor = "grabbing";
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const x = clientX - dragOffset.x;
    const y = clientY - dragOffset.y;
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
    dialog.style.transform = "none";
  };

  const endDrag = () => {
    isDragging = false;
    dialog.style.cursor = "default";
    header.style.cursor = "move";
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (
      e.target === closeBtn ||
      closeBtn.contains(e.target as Node) ||
      e.target === minimizeBtn ||
      minimizeBtn.contains(e.target as Node)
    )
      return;
    startDrag(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    moveDrag(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    endDrag();
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (
      e.target === closeBtn ||
      closeBtn.contains(e.target as Node) ||
      e.target === minimizeBtn ||
      minimizeBtn.contains(e.target as Node)
    )
      return;
    const touch = e.touches[0];
    startDrag(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    moveDrag(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    endDrag();
  };

  header.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
  header.addEventListener("touchstart", handleTouchStart, { passive: false });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd);

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
    header.removeEventListener("touchstart", handleTouchStart);
    document.removeEventListener("touchmove", handleTouchMove);
    document.removeEventListener("touchend", handleTouchEnd);
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
  localStorage.setItem("mr-wplace-dev-visible", "true");
};

export const hideDeveloperDialog = (): void => {
  if (dialogInstance) {
    dialogInstance.dialog.style.display = "none";
    localStorage.setItem("mr-wplace-dev-visible", "false");
    onHideCallback?.();
  }
};

export const setOnHideCallback = (callback: (() => void) | null): void => {
  onHideCallback = callback;
};

export const toggleDeveloperDialog = (): void => {
  const { dialog } = createDeveloperDialog();
  if (dialog.style.display === "none") {
    showDeveloperDialog();
  } else {
    hideDeveloperDialog();
  }
};

export const restoreDeveloperDialogVisibility = (): void => {
  const savedVisible = localStorage.getItem("mr-wplace-dev-visible");
  if (savedVisible === "true") showDeveloperDialog();
};

export const getDeveloperDialogContent = (): HTMLDivElement | null => {
  return dialogInstance?.content ?? null;
};
