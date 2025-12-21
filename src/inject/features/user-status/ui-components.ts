/**
 * User status UI components for inject context
 * Based on src/features/user-status/ui/components.ts
 */

export class StatusUIComponents {
  createContainer(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: absolute;
      top: 5px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      pointer-events: all;
      background-color: var(--color-base-100);
      border-radius: 12px;
      padding: 4px 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s, box-shadow 0.2s;
    `;
    container.id = "user-status-container";

    container.addEventListener("mouseenter", () => {
      container.style.backgroundColor = "var(--color-base-200)";
      container.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
    });
    container.addEventListener("mouseleave", () => {
      container.style.backgroundColor = "var(--color-base-100)";
      container.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.1)";
    });

    return container;
  }

  createNextLevelBadge(): HTMLElement {
    const badge = document.createElement("div");
    badge.style.cssText = `
      display: none;
      line-height: 1.4;
    `;
    return badge;
  }

  createChargeCountdown(): HTMLElement {
    const countdown = document.createElement("div");
    countdown.style.cssText = `
      display: none;
      line-height: 1.4;
    `;
    return countdown;
  }
}
