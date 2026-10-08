import { ensureStyle } from "@/utils/style";
/**
 * User status UI components for inject context
 * Based on src/features/user-status/ui/components.ts
 */

const STYLE_ID = "user-status-style";

const ensureStyles = () => {
  ensureStyle(STYLE_ID, `
    #user-status-container{position:absolute;top:5px;left:50%;translate:-50% 0;display:flex;align-items:flex-start;gap:8px;pointer-events:all;background-color:var(--color-base-100);padding:3px 4px;font-size:11px;font-weight:500;cursor:pointer;z-index:30;
      transition:transform .25s cubic-bezier(.34,1.56,.64,1),background-color .2s;}
    #user-status-container:hover{transform:translateY(2px) scale(1.04);background-color:var(--color-base-200);}
    #user-status-container:active{transform:scale(.94);transition-duration:.08s;}
    @media (prefers-reduced-motion: reduce){#user-status-container{transition:none;}}
  `);
};

export class StatusUIComponents {
  createContainer(): HTMLElement {
    ensureStyles();
    const container = document.createElement("div");
    container.id = "user-status-container";
    container.className = "game-panel-surface";
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
