import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import { AreaFillStorage, AreaFillCorners, type FillPattern } from "./area-fill-storage";
import { findPaintPixelControls } from "@/constants/selectors";
import { getColor, TEXT_COLORS, TEXT_OUTLINE } from "./ui-colors";
import { Toast } from "@/components/toast";

export interface AreaFillUIElements {
  container: HTMLDivElement;
  topLeftValue: HTMLSpanElement;
  bottomRightValue: HTMLSpanElement;
  fillButton: HTMLButtonElement;
  progressGauge: HTMLDivElement;
  update: (corners: AreaFillCorners) => void;
  setRunning: (running: boolean) => void;
  updateProgress: (current: number, total: number) => void;
  getTemplateOnlyMode: () => boolean;
  getFillPattern: () => FillPattern;
  mount: () => void;
  unmount: () => void;
}

const formatCoord = (coord: { lat: number; lng: number } | null): string => {
  if (!coord) return "Not set";
  const { TLX, TLY, PxX, PxY } = latLngToTilePixel(coord.lat, coord.lng);
  return `${TLX}-${TLY}-${PxX}-${PxY}`;
};

/**
 * Request area fill estimate from inject context
 */
const requestAreaFillEstimate = (
  corners: AreaFillCorners,
  options: { skipExistingPixels: boolean; templateOnlyMode: boolean; fillPattern: FillPattern },
): Promise<{ total: number; estimated: number } | null> => {
  return new Promise((resolve) => {
    const requestId = `estimate-${Date.now()}-${Math.random()}`;

    const handleResponse = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-area-fill-estimate-response" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handleResponse);
        if (event.data.error) {
          console.error("🧑‍🎨 : Area fill estimate error:", event.data.error);
          resolve(null);
        } else {
          resolve(event.data.result);
        }
      }
    };

    window.addEventListener("message", handleResponse);

    window.postMessage(
      {
        source: "mr-wplace-area-fill-estimate",
        requestId,
        corners,
        options: {
          skipExistingPixels: options.skipExistingPixels,
          templateOnlyMode: options.templateOnlyMode,
          fillPattern: options.fillPattern,
        },
      },
      "*",
    );

    // Timeout after 10s
    setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      resolve(null);
    }, 10000);
  });
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
    padding: 8px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-left: 2px solid ${getColor("primary", 0.6)};
  `;

  // Header
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  `;

  const icon = document.createElement("span");
  icon.style.cssText = `font-size: 12px;`;
  icon.textContent = "🪣";

  const title = document.createElement("span");
  title.style.cssText = `
    color: ${getColor("primary", 1)};
    font-size: 10px;
    font-weight: 600;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 1px;
    text-transform: uppercase;
    text-shadow: ${TEXT_OUTLINE};
  `;
  title.textContent = "AREA_FILL";

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
  const bottomRightRow = createCoordRow(
    "Bottom-Right",
    initialCorners.bottomRight,
    () => {
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
    }
  );

  // Estimate display
  const estimateDisplay = document.createElement("div");
  estimateDisplay.style.cssText = `
    display: none;
    padding: 4px 6px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
    margin-top: 4px;
  `;

  const estimateText = document.createElement("div");
  estimateText.style.cssText = `
    color: ${TEXT_COLORS.primary};
    font-size: 9px;
    font-family: 'Consolas', 'Monaco', monospace;
    text-align: center;
    text-shadow: ${TEXT_OUTLINE};
  `;
  estimateText.textContent = "Calculating...";

  estimateDisplay.appendChild(estimateText);

  // Progress gauge
  const progressGauge = document.createElement("div");
  progressGauge.style.cssText = `
    display: none;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
    padding: 6px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
  `;

  const progressText = document.createElement("div");
  progressText.style.cssText = `
    color: ${TEXT_COLORS.primary};
    font-size: 9px;
    font-family: 'Consolas', 'Monaco', monospace;
    text-align: center;
    text-shadow: ${TEXT_OUTLINE};
  `;

  const progressBarContainer = document.createElement("div");
  progressBarContainer.style.cssText = `
    width: 100%;
    height: 6px;
    background: rgba(0, 0, 0, 0.1);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.15);
  `;

  const progressBarFill = document.createElement("div");
  progressBarFill.style.cssText = `
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, ${getColor("primary", 0.8)}, ${getColor("primary", 1)});
    transition: width 0.3s ease;
    box-shadow: 0 0 4px ${getColor("primary", 0.3)};
  `;

  progressBarContainer.appendChild(progressBarFill);
  progressGauge.appendChild(progressText);
  progressGauge.appendChild(progressBarContainer);

  // Button row
  const buttonRow = document.createElement("div");
  buttonRow.style.cssText = `
    display: flex;
    gap: 6px;
    margin-top: 6px;
  `;

  // Fill button
  let isRunning = false;
  let isFillBtnHovered = false;
  let isPaintControlsVisible = !!findPaintPixelControls();
  let currentCornersState = initialCorners;
  const fillBtn = document.createElement("button");

  const updateFillBtnStyle = () => {
    const hasCorners =
      currentCornersState.topLeft && currentCornersState.bottomRight;
    // Running中は常にクリック可能（STOPのため）、それ以外はcorners + PaintPixelControls両方必要
    const canFill = isRunning || (hasCorners && isPaintControlsVisible);
    fillBtn.disabled = !canFill;
    fillBtn.style.opacity = canFill ? "1" : "0.4";
    fillBtn.style.cursor = canFill ? "pointer" : "not-allowed";
    if (!canFill) isFillBtnHovered = false;
  };

  const updateSetBtnsStyle = () => {
    // SETボタンはPaintPixelControlsが非表示の時のみクリック可能
    const canSet = !isPaintControlsVisible;
    [topLeftRow.setBtn, bottomRightRow.setBtn].forEach((btn) => {
      btn.disabled = !canSet;
      btn.style.opacity = canSet ? "1" : "0.4";
      btn.style.cursor = canSet ? "pointer" : "not-allowed";
    });
  };
  fillBtn.style.cssText = `
    flex: 1;
    padding: 5px 10px;
    border: 1px solid rgba(255, 255, 255, 0.55);
    border-radius: 6px;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.12));
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 0.9px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-transform: uppercase;
    text-shadow:
      0 1px 1px rgba(0, 0, 0, 0.95),
      1px 0 0 rgba(0, 0, 0, 0.7),
      -1px 0 0 rgba(0, 0, 0, 0.7),
      0 -1px 0 rgba(0, 0, 0, 0.7);
    box-shadow:
      0 2px 10px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `;

  const applyFillBtnVisual = () => {
    if (isRunning) {
      fillBtn.style.background = isFillBtnHovered
        ? "linear-gradient(135deg, rgba(255, 110, 110, 0.45), rgba(140, 0, 0, 0.24))"
        : "linear-gradient(135deg, rgba(255, 100, 100, 0.35), rgba(120, 0, 0, 0.2))";
      fillBtn.style.borderColor = isFillBtnHovered
        ? "rgba(255, 130, 130, 0.9)"
        : "rgba(255, 120, 120, 0.75)";
      fillBtn.style.color = "rgba(255, 245, 245, 0.98)";
      fillBtn.style.boxShadow = isFillBtnHovered
        ? "0 2px 12px rgba(120, 0, 0, 0.45), inset 0 1px 0 rgba(255, 180, 180, 0.45)"
        : "0 2px 10px rgba(120, 0, 0, 0.35), inset 0 1px 0 rgba(255, 170, 170, 0.35)";
      return;
    }

    fillBtn.style.background = isFillBtnHovered
      ? "linear-gradient(135deg, rgba(255, 255, 255, 0.44), rgba(255, 255, 255, 0.2))"
      : "linear-gradient(135deg, rgba(255, 255, 255, 0.32), rgba(255, 255, 255, 0.12))";
    fillBtn.style.borderColor = isFillBtnHovered
      ? "rgba(255, 255, 255, 0.85)"
      : "rgba(255, 255, 255, 0.6)";
    fillBtn.style.color = "rgba(255, 255, 255, 0.98)";
    fillBtn.style.boxShadow = isFillBtnHovered
      ? "0 2px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.7)"
      : "0 2px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.5)";
  };

  fillBtn.textContent = "EXEC";
  updateFillBtnStyle();
  updateSetBtnsStyle();
  applyFillBtnVisual();
  fillBtn.addEventListener("mouseenter", () => {
    if (fillBtn.disabled) return;
    isFillBtnHovered = true;
    applyFillBtnVisual();
  });
  fillBtn.addEventListener("mouseleave", () => {
    if (fillBtn.disabled) return;
    isFillBtnHovered = false;
    applyFillBtnVisual();
  });

  // Clear button
  const clearBtn = document.createElement("button");
  clearBtn.style.cssText = `
    padding: 5px 10px;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.05);
    color: ${TEXT_COLORS.secondary};
    font-size: 10px;
    font-family: 'Consolas', 'Monaco', monospace;
    letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.1s ease;
  `;
  clearBtn.textContent = "CLR";
  clearBtn.addEventListener("mouseenter", () => {
    clearBtn.style.background = "rgba(0, 0, 0, 0.1)";
    clearBtn.style.color = TEXT_COLORS.primary;
  });
  clearBtn.addEventListener("mouseleave", () => {
    clearBtn.style.background = "rgba(0, 0, 0, 0.05)";
    clearBtn.style.color = TEXT_COLORS.secondary;
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

  // Fill pattern + Template Only Mode row
  let currentFillPattern = AreaFillStorage.getFillPattern();
  let templateOnlyModeEnabled = AreaFillStorage.getTemplateOnlyMode();

  const optionsRow = document.createElement("div");
  optionsRow.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
  `;

  // Fill pattern dropdown
  const patternSelect = document.createElement("select");
  patternSelect.style.cssText = `
    flex: 1;
    padding: 2px 4px;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.5);
    color: ${TEXT_COLORS.primary};
    font-size: 9px;
    font-family: 'Consolas', 'Monaco', monospace;
    cursor: pointer;
    outline: none;
  `;
  const patterns: { value: FillPattern; label: string }[] = [
    { value: "linear", label: "LINEAR" },
    { value: "spiralPingPong", label: "SPIRAL" },
  ];
  for (const p of patterns) {
    const opt = document.createElement("option");
    opt.value = p.value;
    opt.textContent = p.label;
    opt.style.cssText = `background: #1a1a2e; color: rgba(255, 255, 255, 0.8);`;
    patternSelect.appendChild(opt);
  }
  patternSelect.value = currentFillPattern;
  patternSelect.addEventListener("change", () => {
    currentFillPattern = patternSelect.value as FillPattern;
    AreaFillStorage.setFillPattern(currentFillPattern);
    console.log("🧑‍🎨 : Area fill pattern:", currentFillPattern);
    // Recalculate estimate
    update(currentCornersState);
  });

  // Template Only Mode - unlock gate + toggle
  const UNLOCK_CLICKS = 5;
  let tmplUnlocked = AreaFillStorage.getTmplUnlocked();
  let unlockClicks = 0;

  const tmplArea = document.createElement("div");
  tmplArea.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    padding: 1px 4px;
    border-radius: 2px;
    cursor: pointer;
    transition: background 0.2s ease, box-shadow 0.2s ease;
    user-select: none;
  `;

  const tmplLabel = document.createElement("span");
  tmplLabel.style.cssText = `
    font-size: 9px;
    font-family: 'Consolas', 'Monaco', monospace;
    text-transform: uppercase;
    flex-shrink: 0;
    transition: color 0.2s ease;
  `;

  const tmplToggle = document.createElement("input");
  tmplToggle.type = "checkbox";
  tmplToggle.style.cssText = `
    width: 14px;
    height: 14px;
    cursor: pointer;
    accent-color: #8b0000;
    flex-shrink: 0;
  `;

  const applyUnlockedStyle = () => {
    tmplLabel.textContent = "TMPL_ONLY";
    tmplLabel.style.color = "#fff";
    tmplLabel.style.textShadow = "0 1px 3px rgba(0, 0, 0, 0.5)";
    tmplArea.style.background = "rgba(180, 30, 30, 0.6)";
    tmplArea.style.border = "1px solid rgba(200, 50, 50, 0.5)";
    tmplArea.style.boxShadow = "inset 0 0 8px rgba(139, 0, 0, 0.3)";
    tmplToggle.style.display = "";
    tmplToggle.checked = templateOnlyModeEnabled;
  };

  const applyLockedStyle = () => {
    tmplLabel.textContent = "TMPL_ONLY";
    const progress = unlockClicks / UNLOCK_CLICKS;
    const r = Math.round(255 * progress);
    tmplLabel.style.color = `rgba(${100 + r * 0.6}, ${255 - r * 0.7}, ${255 - r * 0.7}, ${0.4 + progress * 0.5})`;
    tmplArea.style.background = `rgba(${r}, 0, 0, ${progress * 0.15})`;
    tmplArea.style.boxShadow = progress > 0 ? `inset 0 0 ${4 + progress * 8}px rgba(255, 0, 0, ${progress * 0.2})` : "none";
    tmplToggle.style.display = "none";
  };

  if (tmplUnlocked) applyUnlockedStyle();
  else applyLockedStyle();

  tmplToggle.addEventListener("change", () => {
    templateOnlyModeEnabled = tmplToggle.checked;
    AreaFillStorage.setTemplateOnlyMode(templateOnlyModeEnabled);
    console.log("🧑‍🎨 : Area fill template only mode:", templateOnlyModeEnabled);
    // Recalculate estimate
    update(currentCornersState);
  });

  tmplArea.addEventListener("click", (e) => {
    if (tmplUnlocked) return;
    if (e.target === tmplToggle) return;
    e.preventDefault();
    unlockClicks++;

    if (unlockClicks < UNLOCK_CLICKS) {
      const remaining = UNLOCK_CLICKS - unlockClicks;
      Toast.error(`🔒 LOCKED — ${remaining} more`);
      applyLockedStyle();
    } else {
      tmplUnlocked = true;
      AreaFillStorage.setTmplUnlocked(true);
      applyUnlockedStyle();
      Toast.show("🔓 TMPL_ONLY unlocked", "success");
      console.log("🧑‍🎨 : TMPL_ONLY unlocked");
    }
  });

  tmplArea.appendChild(tmplLabel);
  tmplArea.appendChild(tmplToggle);

  optionsRow.appendChild(patternSelect);
  optionsRow.appendChild(tmplArea);

  container.appendChild(header);
  container.appendChild(topLeftRow.row);
  container.appendChild(bottomRightRow.row);
  container.appendChild(estimateDisplay);
  container.appendChild(optionsRow);
  container.appendChild(progressGauge);
  container.appendChild(buttonRow);

  const setRunning = (running: boolean) => {
    isRunning = running;
    fillBtn.textContent = running ? "STOP" : "EXEC";
    applyFillBtnVisual();

    // Show/hide progress gauge
    progressGauge.style.display = running ? "flex" : "none";
    if (!running) {
      // Reset gauge on stop
      progressBarFill.style.width = "0%";
      progressText.textContent = "";
    }
  };

  const updateProgress = (current: number, total: number) => {
    if (total === 0) return;
    const percentage = Math.round((current / total) * 100);
    progressBarFill.style.width = `${percentage}%`;
    progressText.textContent = `${current} / ${total} (${percentage}%)`;
  };

  const update = async (corners: AreaFillCorners) => {
    currentCornersState = corners;
    topLeftRow.valueSpan.textContent = formatCoord(corners.topLeft);
    topLeftRow.valueSpan.style.color = corners.topLeft
      ? getColor("primary", 1)
      : TEXT_COLORS.tertiary;
    bottomRightRow.valueSpan.textContent = formatCoord(corners.bottomRight);
    bottomRightRow.valueSpan.style.color = corners.bottomRight
      ? getColor("primary", 1)
      : TEXT_COLORS.tertiary;
    updateFillBtnStyle();

    // Calculate and display estimate if both corners are set
    if (corners.topLeft && corners.bottomRight) {
      estimateDisplay.style.display = "block";
      estimateText.textContent = "Calculating...";

      try {
        const estimate = await requestAreaFillEstimate(corners, {
          skipExistingPixels: true,
          templateOnlyMode: templateOnlyModeEnabled,
          fillPattern: currentFillPattern,
        });

        if (estimate) {
          const { total, estimated } = estimate;
          estimateText.textContent = `Area: ${total} px | Target: ${estimated} px`;
        } else {
          estimateText.textContent = "Calculation failed";
        }
      } catch (error) {
        console.error("🧑‍🎨 : Estimate calculation error:", error);
        estimateText.textContent = "Calculation error";
      }
    } else {
      estimateDisplay.style.display = "none";
    }
  };

  // MutationObserver for PaintPixelControls visibility
  let observer: MutationObserver | null = null;

  const mount = () => {
    if (observer) return;
    observer = new MutationObserver(() => {
      const newVisible = !!findPaintPixelControls();
      if (newVisible !== isPaintControlsVisible) {
        const wasVisible = isPaintControlsVisible;
        isPaintControlsVisible = newVisible;
        updateFillBtnStyle();
        updateSetBtnsStyle();

        // Stop area fill if paint modal is closed while running
        if (wasVisible && !newVisible) {
          if (isRunning) {
            window.postMessage({ source: "mr-wplace-area-fill-stop" }, "*");
            setRunning(false);
            console.log("🧑‍🎨 : Area fill stopped (paint modal closed)");
          }
          // Reset progress when paint modal is closed
          window.postMessage({ source: "mr-wplace-area-fill-reset" }, "*");
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Initial check
    isPaintControlsVisible = !!findPaintPixelControls();
    updateFillBtnStyle();
    updateSetBtnsStyle();
  };

  const unmount = () => {
    observer?.disconnect();
    observer = null;
  };

  return {
    container,
    topLeftValue: topLeftRow.valueSpan,
    bottomRightValue: bottomRightRow.valueSpan,
    fillButton: fillBtn,
    progressGauge,
    update,
    setRunning,
    updateProgress,
    getTemplateOnlyMode: () => templateOnlyModeEnabled,
    getFillPattern: () => currentFillPattern,
    mount,
    unmount,
  };
};

const createCoordRow = (
  label: string,
  initialValue: { lat: number; lng: number } | null,
  onSet: () => void
): {
  row: HTMLDivElement;
  valueSpan: HTMLSpanElement;
  setBtn: HTMLButtonElement;
} => {
  const row = document.createElement("div");
  row.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
  `;

  const labelSpan = document.createElement("span");
  labelSpan.style.cssText = `
    color: ${TEXT_COLORS.secondary};
    font-size: 9px;
    font-family: 'Consolas', 'Monaco', monospace;
    width: 55px;
    flex-shrink: 0;
    text-transform: uppercase;
    text-shadow: ${TEXT_OUTLINE};
  `;
  labelSpan.textContent = label.replace("-", "_");

  const valueSpan = document.createElement("span");
  valueSpan.style.cssText = `
    color: ${initialValue ? getColor("primary", 1) : TEXT_COLORS.tertiary};
    font-size: 9px;
    font-family: 'Consolas', 'Monaco', monospace;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    margin-right: 4px;
    text-shadow: ${TEXT_OUTLINE};
  `;
  valueSpan.textContent = formatCoord(initialValue);

  const setBtn = document.createElement("button");
  setBtn.style.cssText = `
    padding: 2px 6px;
    border: 1px solid ${getColor("secondary", 0.4)};
    border-radius: 3px;
    background: ${getColor("secondary", 0.15)};
    color: #fff;
    font-size: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
    cursor: pointer;
    transition: all 0.1s ease;
    flex-shrink: 0;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  `;
  setBtn.textContent = "SET";
  setBtn.addEventListener("mouseenter", () => {
    if (setBtn.disabled) return;
    setBtn.style.background = getColor("secondary", 0.2);
    setBtn.style.boxShadow = `0 0 6px ${getColor("secondary", 0.3)}`;
  });
  setBtn.addEventListener("mouseleave", () => {
    if (setBtn.disabled) return;
    setBtn.style.background = getColor("secondary", 0.1);
    setBtn.style.boxShadow = "none";
  });
  setBtn.addEventListener("click", onSet);

  row.appendChild(labelSpan);
  row.appendChild(valueSpan);
  row.appendChild(setBtn);

  return { row, valueSpan, setBtn };
};
