export class StatusUIComponents {
  createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      align-items: center;
      gap: 12px;
      pointer-events: none;
      background-color: white;
      border-radius: 12px;
      padding: 4px 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 11px;
      font-weight: 500;
    `;
    container.id = "user-status-container";
    return container;
  }

  createNotificationIcon(): HTMLElement {
    const icon = document.createElement("button");
    icon.innerHTML = "🔔";
    icon.style.cssText = `
      order: -1;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      padding: 2px;
      border-radius: 4px;
      pointer-events: all;
      transition: background-color 0.2s;
    `;
    icon.addEventListener("mouseenter", () => {
      icon.style.backgroundColor = "#f3f4f6";
    });
    icon.addEventListener("mouseleave", () => {
      icon.style.backgroundColor = "transparent";
    });
    return icon;
  }

  createNextLevelBadge(): HTMLElement {
    const badge = document.createElement("span");
    badge.style.cssText = `
      color: #333;
      display: none;
      align-items: center;
      white-space: nowrap;
    `;
    return badge;
  }

  createChargeCountdown(): HTMLElement {
    const countdown = document.createElement("span");
    countdown.style.cssText = `
      color: #333;
      display: none;
      align-items: center;
      white-space: nowrap;
    `;
    return countdown;
  }
}
