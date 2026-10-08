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
      display: flex;
      align-items: flex-start;
      gap: 8px;
      pointer-events: all;
      background-color: var(--color-base-100);
      padding: 3px 4px 3px 4px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
      z-index: 30;
    `;
    container.id = "user-status-container";

    container.addEventListener("mouseenter", () => {
      container.style.backgroundColor = "var(--color-base-200)";
    });
    container.addEventListener("mouseleave", () => {
      container.style.backgroundColor = "var(--color-base-100)";
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
