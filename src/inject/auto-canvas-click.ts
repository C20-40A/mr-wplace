/**
 * Auto Canvas Click
 * Automatically simulates Space keypress when cursor is over target colors on the canvas
 */

let isEnabled = false;
let rafId: number | null = null;
let sourceCanvas: HTMLCanvasElement | null = null;
let dumpCanvas: HTMLCanvasElement | null = null;
let dumpCtx: CanvasRenderingContext2D | null = null;
let isSpacePressed = false; // スペースキーの押下状態を追跡

// ターゲットカラーリスト
// MapLibre GLの描画は常にRGBA形式 (R, G, B, Alpha)

// keydownトリガー用（255,0,0,255を含まない）
const TRIGGER_COLORS: [number, number, number, number][] = [
  [235, 82, 82, 255], // rgb(235, 82, 82)
  [254, 101, 101, 255], // rgb(254, 101, 101)
  [153, 0, 0, 255], // rgb(153, 0, 0)
];

// keydown継続用（255,0,0,255を含む）
const CONTINUE_COLORS: [number, number, number, number][] = [
  [235, 82, 82, 255], // rgb(235, 82, 82)
  [254, 101, 101, 255], // rgb(254, 101, 101)
  [153, 0, 0, 255], // rgb(153, 0, 0)
  [255, 0, 0, 255], // rgb(255, 0, 0) - 継続時のみ判定
];

const initCanvases = (): boolean => {
  sourceCanvas = document.querySelector("canvas.maplibregl-canvas");
  if (!sourceCanvas) {
    console.warn("🧑‍🎨 : MapLibre canvas not found");
    return false;
  }

  if (!dumpCanvas) {
    dumpCanvas = document.createElement("canvas");
  }

  dumpCanvas.width = sourceCanvas.width;
  dumpCanvas.height = sourceCanvas.height;
  dumpCtx = dumpCanvas.getContext("2d", { willReadFrequently: true });

  if (!dumpCtx) {
    console.warn("🧑‍🎨 : Failed to get 2D context for dump canvas");
    return false;
  }

  return true;
};

const refresh = (): void => {
  if (!sourceCanvas || !dumpCanvas || !dumpCtx || !isEnabled) return;

  dumpCtx.drawImage(sourceCanvas, 0, 0);
  rafId = requestAnimationFrame(refresh);
};

const handleMouseMove = (e: MouseEvent): void => {
  if (!isEnabled || !sourceCanvas || !dumpCtx || !dumpCanvas) return;

  const rect = sourceCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const x_css = e.clientX - rect.left;
  const y_css = e.clientY - rect.top;

  const x_draw = Math.floor(x_css * dpr);
  const y_draw = Math.floor(y_css * dpr);

  if (
    x_draw < 0 ||
    x_draw >= dumpCanvas.width ||
    y_draw < 0 ||
    y_draw >= dumpCanvas.height
  )
    return;

  const d = dumpCtx.getImageData(x_draw, y_draw, 1, 1).data;

  // スペースが押されていない状態 → トリガー色のみチェック
  if (!isSpacePressed) {
    const isTriggerColor = TRIGGER_COLORS.some(
      (target) =>
        d[0] === target[0] && d[1] === target[1] && d[2] === target[2] && d[3] === target[3]
    );

    if (isTriggerColor) {
      const keyDownEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        view: window,
        key: " ",
        code: "Space",
        keyCode: 32,
      });
      sourceCanvas.dispatchEvent(keyDownEvent);
      isSpacePressed = true;
      console.log("🧑‍🎨 : Trigger color detected, Space key pressed");
    }
  } else {
    // スペースが押されている状態 → 継続色（255,0,0,255を含む）でチェック
    const isContinueColor = CONTINUE_COLORS.some(
      (target) =>
        d[0] === target[0] && d[1] === target[1] && d[2] === target[2] && d[3] === target[3]
    );

    if (!isContinueColor) {
      // 継続色でなくなったら → スペースを離す
      const keyUpEvent = new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        view: window,
        key: " ",
        code: "Space",
        keyCode: 32,
      });
      sourceCanvas.dispatchEvent(keyUpEvent);
      isSpacePressed = false;
      console.log("🧑‍🎨 : Non-continue color detected, Space key released");
    }
    // 継続色なら何もしない（押したまま維持）
  }
};

export const startAutoCanvasClick = (): void => {
  if (isEnabled) return;

  if (!initCanvases()) {
    console.error("🧑‍🎨 : Failed to initialize canvases for auto canvas click");
    return;
  }

  isEnabled = true;
  console.log("🧑‍🎨 : Auto canvas click started");

  // Start refresh loop
  refresh();

  // Add mouse move listener
  if (sourceCanvas) {
    sourceCanvas.addEventListener("mousemove", handleMouseMove);
  }
};

export const stopAutoCanvasClick = (): void => {
  if (!isEnabled) return;

  isEnabled = false;
  console.log("🧑‍🎨 : Auto canvas click stopped");

  // Stop refresh loop
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // Remove mouse move listener
  if (sourceCanvas) {
    sourceCanvas.removeEventListener("mousemove", handleMouseMove);
  }

  // スペースが押されたままなら離す
  if (isSpacePressed && sourceCanvas) {
    const keyUpEvent = new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      view: window,
      key: " ",
      code: "Space",
      keyCode: 32,
    });
    sourceCanvas.dispatchEvent(keyUpEvent);
    isSpacePressed = false;
    console.log("🧑‍🎨 : Space key released on stop");
  }
};

export const isAutoCanvasClickEnabled = (): boolean => isEnabled;
