const OVERLAY_Z_INDEX = 2001;
const PANEL_VIEWPORT_MARGIN = 12;

export const PANEL_VIEWPORT_MARGIN_PX = PANEL_VIEWPORT_MARGIN;

export const STYLES = {
  toolButtonBar: `
    position: fixed;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    pointer-events: auto;
    z-index: ${OVERLAY_Z_INDEX + 2};
  `,
  toolButton: `
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    padding: 0.3rem 0.55rem;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s;
  `,
  toolButtonActive: `
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.9);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    padding: 0.3rem 0.55rem;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s;
  `,
  floatingPanel: `
    position: fixed;
    background: var(--color-base-100, #fff);
    border-radius: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
    z-index: ${OVERLAY_Z_INDEX + 3};
    max-height: 70vh;
    overflow-y: auto;
    width: min(340px, calc(100vw - ${PANEL_VIEWPORT_MARGIN * 2}px));
    min-width: min(280px, calc(100vw - ${PANEL_VIEWPORT_MARGIN * 2}px));
    max-width: 340px;
  `,
} as const;

export const injectPanelStyles = (): void => {
  const styleId = "mr-wplace-adjust-tool-styles";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .iat-panel-section { margin-bottom: 0.5rem; }
    .iat-panel-section:last-child { margin-bottom: 0; }
    .iat-slider-row {
      display: flex; align-items: center; gap: 0.4rem;
    }
    .iat-slider-row input[type="range"] { flex: 1; min-width: 0; }
    .iat-slider-label {
      font-size: 0.75rem; font-weight: 500; margin-bottom: 0.2rem;
      display: flex; justify-content: space-between; align-items: center;
    }
    .iat-slider-value { font-size: 0.7rem; color: #9ca3af; }
    .iat-hint { font-size: 0.65rem; color: #9ca3af; }
    .iat-checkbox-row {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.75rem; cursor: pointer;
    }
    .iat-select { font-size: 0.72rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; border: 1px solid #d1d5db; }
    .iat-select-row { display: flex; gap: 0.35rem; align-items: center; }
    .iat-select-row select { flex: 1; min-width: 0; }
    .iat-outline-params {
      display: flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem;
    }
    .iat-outline-params .iat-slider-row { flex: 1; }
    .iat-floating-panel-header {
      position: sticky;
      top: 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.75rem 0.75rem 0.5rem;
      background: var(--color-base-100, #fff);
      border-bottom: 1px solid rgba(156, 163, 175, 0.25);
      border-radius: 0.75rem 0.75rem 0 0;
      cursor: move;
      touch-action: none;
      z-index: 1;
    }
    .iat-floating-panel-title {
      font-size: 0.78rem;
      font-weight: 700;
      line-height: 1.2;
    }
    .iat-floating-panel-close {
      width: 1.75rem;
      height: 1.75rem;
      min-width: 1.75rem;
      border: none;
      border-radius: 999px;
      background: rgba(0, 0, 0, 0.08);
      cursor: pointer;
      font-size: 0.9rem;
      line-height: 1;
    }
    .iat-floating-panel-close:hover {
      background: rgba(0, 0, 0, 0.14);
    }
    .iat-floating-panel-body {
      padding: 0.75rem;
    }
  `;
  document.head.appendChild(style);
};
