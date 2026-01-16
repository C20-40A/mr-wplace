import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { AreaFillStorage, AreaFillCorners } from "./area-fill-storage";

interface AreaFillUIElements {
  container: HTMLDivElement;
  topLeftValue: HTMLSpanElement;
  bottomRightValue: HTMLSpanElement;
  fillButton: HTMLButtonElement;
  update: (corners: AreaFillCorners) => void;
  setRunning: (running: boolean) => void;
}

const formatCoord = (coord: { lat: number; lng: number } | null): string => {
  if (!coord) return "Not set";
  const { TLX, TLY, PxX, PxY } = latLngToTilePixel(coord.lat, coord.lng);
  return `${TLX}-${TLY}-${PxX}-${PxY}`;
};

export const createAreaFillDialogItem = (
  initialCorners: AreaFillCorners,
  onCornersChange?: (corners: AreaFillCorners) => void
): AreaFillUIElements => {
  const container = document.createElement("div");
  container.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  `;

  const icon = document.createElement("span");
  icon.style.cssText = `font-size: 14px;`;
  icon.textContent = "🪣";

  const title = document.createElement("span");
  title.style.cssText = `
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    font-weight: 500;
  `;
  title.textContent = "Area Fill";

  header.appendChild(icon);
  header.appendChild(title);

  // Top Left row
  const topLeftRow = createCoordRow("Top-Left", initialCorners.topLeft, () => {
    const pos = getCurrentPosition();
    if (!pos) {
      console.log("🧑‍🎨 : No current position available");
      return;
    }
    AreaFillStorage.setTopLeft(pos.lat, pos.lng);
    const corners = AreaFillStorage.getCorners();
    update(corners);
    onCornersChange?.(corners);
    console.log("🧑‍🎨 : Area fill top-left set:", pos.lat, pos.lng);
  });

  // Bottom Right row
  const bottomRightRow = createCoordRow("Bottom-Right", initialCorners.bottomRight, () => {
    const pos = getCurrentPosition();
    if (!pos) {
      console.log("🧑‍🎨 : No current position available");
      return;
    }
    AreaFillStorage.setBottomRight(pos.lat, pos.lng);
    const corners = AreaFillStorage.getCorners();
    update(corners);
    onCornersChange?.(corners);
    console.log("🧑‍🎨 : Area fill bottom-right set:", pos.lat, pos.lng);
  });

  // Button row
  const buttonRow = document.createElement("div");
  buttonRow.style.cssText = `
    display: flex;
    gap: 6px;
    margin-top: 6px;
  `;

  // Fill button
  let isRunning = false;
  const fillBtn = document.createElement("button");
  const updateFillBtnStyle = (corners: AreaFillCorners) => {
    const canFill = corners.topLeft && corners.bottomRight;
    fillBtn.disabled = !canFill && !isRunning;
    fillBtn.style.opacity = canFill || isRunning ? "1" : "0.4";
    fillBtn.style.cursor = canFill || isRunning ? "pointer" : "not-allowed";
  };
  fillBtn.style.cssText = `
    flex: 1;
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: rgba(34, 197, 94, 0.2);
    color: rgba(34, 197, 94, 0.9);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s ease, opacity 0.15s ease;
  `;
  fillBtn.textContent = "Fill";
  updateFillBtnStyle(initialCorners);
  fillBtn.addEventListener("mouseenter", () => {
    if (fillBtn.disabled) return;
    fillBtn.style.background = isRunning
      ? "rgba(239, 68, 68, 0.3)"
      : "rgba(34, 197, 94, 0.3)";
  });
  fillBtn.addEventListener("mouseleave", () => {
    if (fillBtn.disabled) return;
    fillBtn.style.background = isRunning
      ? "rgba(239, 68, 68, 0.2)"
      : "rgba(34, 197, 94, 0.2)";
  });

  // Clear button
  const clearBtn = document.createElement("button");
  clearBtn.style.cssText = `
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.15s ease;
  `;
  clearBtn.textContent = "Clear";
  clearBtn.addEventListener("mouseenter", () => {
    clearBtn.style.background = "rgba(255, 255, 255, 0.15)";
  });
  clearBtn.addEventListener("mouseleave", () => {
    clearBtn.style.background = "rgba(255, 255, 255, 0.1)";
  });
  clearBtn.addEventListener("click", () => {
    AreaFillStorage.clear();
    const corners = AreaFillStorage.getCorners();
    update(corners);
    onCornersChange?.(corners);
    console.log("🧑‍🎨 : Area fill corners cleared");
  });

  buttonRow.appendChild(fillBtn);
  buttonRow.appendChild(clearBtn);

  container.appendChild(header);
  container.appendChild(topLeftRow.row);
  container.appendChild(bottomRightRow.row);
  container.appendChild(buttonRow);

  const setRunning = (running: boolean) => {
    isRunning = running;
    fillBtn.textContent = running ? "Stop" : "Fill";
    fillBtn.style.background = running
      ? "rgba(239, 68, 68, 0.2)"
      : "rgba(34, 197, 94, 0.2)";
    fillBtn.style.color = running
      ? "rgba(239, 68, 68, 0.9)"
      : "rgba(34, 197, 94, 0.9)";
  };

  const update = (corners: AreaFillCorners) => {
    topLeftRow.valueSpan.textContent = formatCoord(corners.topLeft);
    topLeftRow.valueSpan.style.color = corners.topLeft
      ? "rgba(34, 197, 94, 0.9)"
      : "rgba(255, 255, 255, 0.4)";
    bottomRightRow.valueSpan.textContent = formatCoord(corners.bottomRight);
    bottomRightRow.valueSpan.style.color = corners.bottomRight
      ? "rgba(34, 197, 94, 0.9)"
      : "rgba(255, 255, 255, 0.4)";
    updateFillBtnStyle(corners);
  };

  return {
    container,
    topLeftValue: topLeftRow.valueSpan,
    bottomRightValue: bottomRightRow.valueSpan,
    fillButton: fillBtn,
    update,
    setRunning,
  };
};

const createCoordRow = (
  label: string,
  initialValue: { lat: number; lng: number } | null,
  onSet: () => void
): { row: HTMLDivElement; valueSpan: HTMLSpanElement } => {
  const row = document.createElement("div");
  row.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  const labelSpan = document.createElement("span");
  labelSpan.style.cssText = `
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    width: 70px;
    flex-shrink: 0;
  `;
  labelSpan.textContent = label;

  const valueSpan = document.createElement("span");
  valueSpan.style.cssText = `
    color: ${initialValue ? "rgba(34, 197, 94, 0.9)" : "rgba(255, 255, 255, 0.4)"};
    font-size: 10px;
    font-family: monospace;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;
  valueSpan.textContent = formatCoord(initialValue);

  const setBtn = document.createElement("button");
  setBtn.style.cssText = `
    padding: 3px 8px;
    border: none;
    border-radius: 4px;
    background: rgba(59, 130, 246, 0.2);
    color: rgba(59, 130, 246, 0.9);
    font-size: 10px;
    cursor: pointer;
    transition: background 0.15s ease;
    flex-shrink: 0;
  `;
  setBtn.textContent = "Set";
  setBtn.addEventListener("mouseenter", () => {
    setBtn.style.background = "rgba(59, 130, 246, 0.3)";
  });
  setBtn.addEventListener("mouseleave", () => {
    setBtn.style.background = "rgba(59, 130, 246, 0.2)";
  });
  setBtn.addEventListener("click", onSet);

  row.appendChild(labelSpan);
  row.appendChild(valueSpan);
  row.appendChild(setBtn);

  return { row, valueSpan };
};
