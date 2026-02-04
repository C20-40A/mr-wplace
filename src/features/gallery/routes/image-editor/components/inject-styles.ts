import type { CreateElementFn } from "./types";

export const injectImageEditorStyles = (createElement: CreateElementFn): void => {
  const styleId = "wps-image-editor-styles";
  if (document.getElementById(styleId)) return;

  const style = createElement("style", { id: styleId }, [
    `
      #wps-image-editor-container.desktop #wps-main-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 2fr 3fr;
        height: 80vh;
        overflow: hidden;
        gap: 0.1rem;
      }
      #wps-image-editor-container.mobile #wps-main-grid {
        display: flex;
        flex-direction: column;
        height: auto;
        overflow: visible;
        gap: 0.1rem;
      }
      #wps-original-area, #wps-current-area, #wps-palette-area, #wps-controls-area {
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 0.5rem;
        min-height: 0;
      }
      #wps-original-area { position: relative; }
      #wps-image-editor-container.desktop #wps-original-area,
      #wps-image-editor-container.desktop #wps-current-area,
      #wps-image-editor-container.desktop #wps-palette-area,
      #wps-image-editor-container.desktop #wps-controls-area {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
      #wps-image-editor-container.desktop #wps-original-area { overflow: hidden; }
      #wps-original-image-layer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }
      #wps-image-replace-zone {
        position: absolute; inset: 0; cursor: pointer; display: flex; justify-content: center; align-items: center;
      }
      #wps-original-image {
        border: 1px solid #e5e7eb; border-radius: 0.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: auto; height: auto; max-width: none; max-height: none; object-fit: contain; image-rendering: pixelated; image-rendering: -webkit-optimize-contrast;
      }
      #wps-image-editor-container.mobile #wps-original-image {
        max-width: 100%; max-height: 40vh;
      }
      #wps-replace-overlay {
        position: absolute; inset: 0; background: rgba(0,0,0,0.7); border-radius: 0.25rem; display: none; align-items: center; justify-content: center; color: white; font-size: 0.875rem; text-align: center; padding: 1rem;
      }
      #wps-current-area .flex {
        justify-content: center; position: relative; width: 100%; height: 100%; box-sizing: border-box;
      }
      #wps-canvas-container {
        min-width: 100%; min-height: 0; height: 100%; max-width: 100%; max-height: 100%; overflow: hidden; position: relative;
      }
      #wps-image-editor-container.mobile #wps-canvas-container { display: none; }
      #wps-image-editor-container.desktop #wps-canvas-container { display: block; }

      #wps-scaled-canvas {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      }
      #wps-image-container { display: none; width: 100%; max-width: 100%; }
      #wps-image-editor-container.mobile #wps-image-container { display: block; }
      #wps-image-editor-container.desktop #wps-image-container { display: none; }
      #wps-scaled-image {
        width: 100%; height: auto; image-rendering: pixelated; image-rendering: -webkit-optimize-contrast;
      }
      .gpu-toggle-label {
        position: absolute; bottom: 0.25rem; right: 0.25rem; display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; cursor: pointer; background: var(--color-base-300); padding: 0.2rem 0.4rem; border-radius: 0.25rem; opacity: 0.6; transition: opacity 0.2s;
      }
      .gpu-toggle-label:hover { opacity: 1; }

      #wps-palette-accordion { list-style: none; }
      #wps-palette-accordion summary { font-size: 0.875rem; font-weight: 500; cursor: pointer; margin: 0.5rem; }
      #wps-image-editor-container.desktop #wps-palette-accordion { display: none; }
      #wps-image-editor-container.mobile #wps-palette-accordion { display: block; }
      #wps-image-editor-container.desktop #wps-palette-desktop { display: block; }
      #wps-image-editor-container.mobile #wps-palette-desktop { display: none; }

      #wps-controls-container { display: flex; flex-direction: column; gap: 1rem; }
      .control-label { display: flex; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
      .control-label.space-between { justify-content: space-between; }
      .control-label.centered { justify-content: center; }
      .label-hint { font-size: 0.75rem; color: #9ca3af; }
      .label-hint-sm { font-size: 0.65rem; color: #9ca3af; }
      .flex-group { display: flex; gap: 0.5rem; align-items: center; }
      .flex-group .range { flex: 1; min-width: 0; }
      #wps-width-input, #wps-height-input { width: 60px; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center; }
      .control-group { display: flex; gap: 0.75rem; }
      .control-item { flex: 1; min-width: 0; }
      .control-item .range { width: 100%; display: block; }
      .cursor-pointer { cursor: pointer; }

      #wps-image-editor-container.mobile .control-group { flex-direction: column; }
      #wps-image-editor-container.desktop .control-group { flex-direction: row; }

      .control-label-sm { display: block; font-size: 0.75rem; font-weight: 500; margin-bottom: 0.25rem; }
      .grid-4-col { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; }
      .grid-4-col input { width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center; }
      .flex { display: flex; gap: 0.5rem; }
      .flex-1 { flex: 1; }

      #wps-palette-area { display: flex; flex-direction: column; }
      #wps-palette-scroll-area { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
      #wps-transparent-section { flex-shrink: 0; padding: 0 0.5rem 0.25rem; }
      .wps-transparent-divider { height: 1px; background: #e5e7eb; margin: 0.25rem 0; }
      .wps-transparency-tool-btn {
        width: 100%; margin-top: 0.25rem; font-size: 0.75rem;
      }

      #wps-transparency-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center;
      }
      #wps-transparency-dialog {
        background: var(--color-base-100, #fff); border-radius: 0.75rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3); padding: 1rem;
        width: 90vw; max-width: 480px; max-height: 85vh;
        display: flex; flex-direction: column; gap: 0.5rem;
        overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;
      }
      .wps-td-header {
        display: flex; justify-content: space-between; align-items: center;
      }
      .wps-td-title {
        font-size: 0.95rem; font-weight: 600;
      }
      .wps-td-close {
        background: none; border: none; font-size: 1rem; cursor: pointer;
        color: #9ca3af; padding: 0.25rem; line-height: 1;
      }
      .wps-td-close:hover { color: #374151; }
      .wps-td-mode-label {
        font-size: 0.8rem; font-weight: 500;
      }
      .wps-td-mode-desc {
        font-size: 0.7rem; color: #6b7280; line-height: 1.3;
      }
      #wps-td-canvas-wrap {
        border: 1px solid #e5e7eb; border-radius: 0.5rem;
        background: repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 0 0 / 16px 16px;
        display: flex; align-items: center; justify-content: center;
        min-height: 200px; overflow: hidden;
      }
      #wps-td-canvas {
        max-width: 100%; max-height: 50vh; object-fit: contain;
      }
      .wps-td-no-image {
        font-size: 0.8rem; color: #9ca3af; padding: 2rem; text-align: center;
      }
      .wps-td-control-group {
        display: flex; flex-direction: column; gap: 0.2rem;
      }
      .wps-td-label {
        font-size: 0.75rem; font-weight: 500;
      }
      .wps-td-slider-row {
        display: flex; align-items: center; gap: 0.5rem;
      }
      .wps-td-slider-row input[type="range"] { flex: 1; min-width: 0; }
      .wps-td-value {
        font-size: 0.7rem; color: #6b7280; min-width: 2rem; text-align: right;
      }
      .wps-td-actions {
        display: flex; gap: 0.5rem; justify-content: flex-end;
      }
    `,
  ]);

  document.head.appendChild(style);
};
