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
      pointer-events: all;
      background-color: white;
      border-radius: 12px;
      padding: 4px 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s, box-shadow 0.2s;
    `;
    container.id = "user-status-container";
    
    container.addEventListener("mouseenter", () => {
      container.style.backgroundColor = "#f8f9fa";
      container.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    });
    container.addEventListener("mouseleave", () => {
      container.style.backgroundColor = "white";
      container.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
    });
    
    return container;
  }

  createNotificationIcon(): HTMLElement {
    const icon = document.createElement("span");
    icon.innerHTML = "🔔";
    icon.style.cssText = `
      order: -1;
      font-size: 14px;
      pointer-events: none;
    `;
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
