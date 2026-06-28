import { getColor, TEXT_COLORS, TEXT_OUTLINE } from "./ui-colors";
import { t } from "@/i18n/manager";
import { toggleDeveloperMenu } from "./developer-menu";

interface DeveloperDialogElements {
  dialog: HTMLDivElement;
  content: HTMLDivElement;
  destroy: () => void;
}

let dialogInstance: DeveloperDialogElements | null = null;
let onHideCallback: (() => void) | null = null;
const DEV_WARNING_ACK_KEY = "mr-wplace-dev-warning-ack";
const stopInteractionPropagation = (event: Event): void => {
  event.stopPropagation();
};

const hasOpenAppModal = (): boolean =>
  !!document.querySelector(".modal.modal-open, .modal[open]");

export const createDeveloperDialog = (): DeveloperDialogElements => {
  // 既存のダイアログがあれば再利用
  if (dialogInstance) return dialogInstance;

  const hasAcknowledgedWarning =
    localStorage.getItem(DEV_WARNING_ACK_KEY) === "true";

  const dialog = document.createElement("div");
  dialog.id = "mr-wplace-dev-dialog";
  dialog.style.cssText = `
    position: fixed;
    top: 44px;
    left: 16px;
    transform: none;
    z-index: 9999;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-left: 2px solid ${getColor("primary", 0.5)};
    border-radius: 8px;
    padding: 10px 12px;
    min-width: 170px;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.1),
      0 2px 8px rgba(0, 0, 0, 0.05),
      inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    display: none;
    cursor: default;
    user-select: none;
    font-family: 'Consolas', 'Monaco', monospace;
  `;
  ["pointerdown", "mousedown", "click", "touchstart"].forEach((eventName) => {
    dialog.addEventListener(eventName, stopInteractionPropagation);
  });

  const triggerButton = document.getElementById("dev-trigger-btn");
  if (triggerButton) {
    const rect = triggerButton.getBoundingClientRect();
    dialog.style.left = `${Math.max(8, rect.left)}px`;
    dialog.style.top = `${Math.max(8, rect.bottom + 8)}px`;
  }

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding: 2px 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    padding-bottom: 6px;
    transition: all 0.2s ease;
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
    transition: all 0.2s ease;
    text-shadow: ${TEXT_OUTLINE};
  `;
  title.textContent = "DEBUG MENU for DEV";

  const warning = document.createElement("span");
  warning.style.cssText = `
    color: ${TEXT_COLORS.tertiary};
    font-size: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    line-height: 1.2;
    max-width: 150px;
    display: block;
    text-shadow: ${TEXT_OUTLINE};
  `;
  warning.textContent =
    "This is a private feature for development testing only.";

  titleWrapper.appendChild(title);
  titleWrapper.appendChild(warning);

  // Button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.cssText = `
    display: flex;
    gap: 4px;
    align-items: center;
    transition: all 0.2s ease;
  `;

  const menuBtn = document.createElement("button");
  menuBtn.style.cssText = `
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.15);
    color: ${TEXT_COLORS.secondary};
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.15s ease;
    width: 22px;
    height: 22px;
    font-size: 11px;
  `;
  menuBtn.textContent = "🛠️";
  menuBtn.addEventListener("mouseenter", () => {
    menuBtn.style.color = getColor("primary", 1);
    menuBtn.style.borderColor = getColor("primary", 0.4);
    menuBtn.style.background = getColor("primary", 0.1);
  });
  menuBtn.addEventListener("mouseleave", () => {
    menuBtn.style.color = TEXT_COLORS.secondary;
    menuBtn.style.borderColor = "rgba(0, 0, 0, 0.15)";
    menuBtn.style.background = "rgba(0, 0, 0, 0.05)";
  });
  menuBtn.addEventListener("mousedown", () => {
    menuBtn.style.transform = "scale(0.95)";
  });
  menuBtn.addEventListener("mouseup", () => {
    menuBtn.style.transform = "scale(1)";
  });
  menuBtn.addEventListener("click", (event) => {
    event.preventDefault();
    toggleDeveloperMenu();
  });

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.style.cssText = `
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.15);
    color: ${TEXT_COLORS.secondary};
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
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
    closeBtn.style.color = "rgba(220, 50, 50, 1)";
    closeBtn.style.borderColor = "rgba(220, 50, 50, 0.4)";
    closeBtn.style.background = "rgba(220, 50, 50, 0.1)";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.color = TEXT_COLORS.secondary;
    closeBtn.style.borderColor = "rgba(0, 0, 0, 0.15)";
    closeBtn.style.background = "rgba(0, 0, 0, 0.05)";
  });
  closeBtn.addEventListener("mousedown", () => {
    closeBtn.style.transform = "scale(0.95)";
  });
  closeBtn.addEventListener("mouseup", () => {
    closeBtn.style.transform = "scale(1)";
  });
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    hideDeveloperDialog();
  });

  buttonContainer.appendChild(menuBtn);
  buttonContainer.appendChild(closeBtn);

  header.appendChild(titleWrapper);
  header.appendChild(buttonContainer);

  // Content area
  const content = document.createElement("div");
  content.id = "mr-wplace-dev-dialog-content";
  content.style.cssText = `
    display: ${hasAcknowledgedWarning ? "flex" : "none"};
    flex-direction: column;
    gap: 8px;
  `;

  const splash = document.createElement("div");
  splash.style.cssText = `
    display: ${hasAcknowledgedWarning ? "none" : "flex"};
    flex-direction: column;
    gap: 10px;
    min-width: 330px;
    max-width: 320px;
    padding: 4px 0 2px;
  `;

  const splashTitle = document.createElement("div");
  splashTitle.style.cssText = `
    color: ${getColor("primary", 1)};
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-shadow: ${TEXT_OUTLINE};
  `;
  splashTitle.textContent = t`${"developer_warning_splash_title"}`;

  const splashBody = document.createElement("div");
  splashBody.style.cssText = `
    color: ${TEXT_COLORS.secondary};
    font-size: 10px;
    line-height: 1.45;
    white-space: pre-line;
    text-shadow: ${TEXT_OUTLINE};
  `;
  splashBody.textContent = t`${"developer_warning_splash_body"}`;

  const splashButtonRow = document.createElement("div");
  splashButtonRow.style.cssText = `
    display: flex;
    gap: 6px;
    justify-content: flex-end;
    margin-top: 2px;
  `;

  const splashCloseButton = document.createElement("button");
  splashCloseButton.style.cssText = `
    margin-top: 2px;
    padding: 5px 12px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.25);
    background: rgba(0, 0, 0, 0.08);
    color: ${TEXT_COLORS.secondary};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    cursor: pointer;
  `;
  splashCloseButton.textContent = t`${"developer_warning_splash_close"}`;
  splashCloseButton.addEventListener("click", (event) => {
    event.preventDefault();
    hideDeveloperDialog();
  });

  const splashOkButton = document.createElement("button");
  splashOkButton.style.cssText = `
    padding: 5px 12px;
    border-radius: 4px;
    border: 1px solid ${getColor("primary", 0.5)};
    background: ${getColor("primary", 0.15)};
    color: ${TEXT_COLORS.primary};
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.4px;
    cursor: pointer;
  `;
  splashOkButton.textContent = t`${"developer_warning_splash_ok"}`;
  splashOkButton.addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.setItem(DEV_WARNING_ACK_KEY, "true");
    splash.style.display = "none";
    header.style.display = "flex";
    warning.style.display = "block";
    content.style.display = "flex";
  });

  splash.appendChild(splashTitle);
  splash.appendChild(splashBody);
  splashButtonRow.appendChild(splashCloseButton);
  splashButtonRow.appendChild(splashOkButton);
  splash.appendChild(splashButtonRow);

  header.style.display = hasAcknowledgedWarning ? "flex" : "none";

  dialog.appendChild(header);
  dialog.appendChild(splash);
  dialog.appendChild(content);
  document.body.appendChild(dialog);

  // ESC to close
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && dialog.style.display !== "none") {
      hideDeveloperDialog();
    }
  };
  const closeWhenAppModalOpens = () => {
    if (dialog.style.display === "none") return;
    if (!hasOpenAppModal()) return;
    hideDeveloperDialog();
  };
  const modalObserver = new MutationObserver(closeWhenAppModalOpens);
  document.addEventListener("keydown", handleKeydown);
  modalObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "open"],
    childList: true,
    subtree: true,
  });

  const destroy = () => {
    document.removeEventListener("keydown", handleKeydown);
    modalObserver.disconnect();
    ["pointerdown", "mousedown", "click", "touchstart"].forEach(
      (eventName) => {
        dialog.removeEventListener(eventName, stopInteractionPropagation);
      },
    );
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

    // Stop area fill if running
    window.postMessage({ source: "mr-wplace-area-fill-stop" }, "*");

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
