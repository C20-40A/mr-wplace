const src = document.querySelector("canvas.maplibregl-canvas");

// デバイスピクセル比を取得 (座標修正のため必須)
const dpr = window.devicePixelRatio || 1;

const dump = document.createElement("canvas");
dump.width = src.width;
dump.height = src.height;
const ctx = dump.getContext("2d");

// 毎フレームコピー
function refresh() {
  ctx.drawImage(src, 0, 0);
  requestAnimationFrame(refresh);
}
refresh();

// pixel 読み取り
src.addEventListener("mousemove", (e) => {
  const rect = src.getBoundingClientRect();
  const x_css = e.clientX - rect.left; // CSSピクセル座標
  const y_css = e.clientY - rect.top; // CSSピクセル座標

  // CSSピクセル座標を内部描画ピクセル座標にスケーリング
  const x_draw = Math.floor(x_css * dpr);
  const y_draw = Math.floor(y_css * dpr);

  // スケールされた座標でピクセルを読み取る
  if (
    x_draw >= 0 &&
    x_draw < dump.width &&
    y_draw >= 0 &&
    y_draw < dump.height
  ) {
    const d = ctx.getImageData(x_draw, y_draw, 1, 1).data; // [R, G, B, A]

    // ⭐ ターゲットカラーリストの定義
    // MapLibre GLの描画は常にRGBA形式 (R, G, B, Alpha) で、Alphaは255（不透明）と想定
    const targetColors = [
      [235, 82, 82, 255], // rgb(235, 82, 82)
      [254, 101, 101, 255], // rgb(254, 101, 101)
      [153, 0, 0, 255], // rgb(153, 0, 0)
      // [255, 0, 0, 255], // rgb(255, 0, 0) これがあると安定しない
    ];

    // ⭐ 読み取った色がターゲットリストのいずれかと一致するかチェック
    const isTargetColor = targetColors.some(
      (target) =>
        d[0] === target[0] && // R
        d[1] === target[1] && // G
        d[2] === target[2] && // B
        d[3] === target[3] // A (Alpha)
    );

    if (isTargetColor) {
      // 自動でSpaceキー押下をシミュレート
      const keyDownEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        view: window,
        key: " ",
        code: "Space",
        keyCode: 32,
      });

      const keyUpEvent = new KeyboardEvent("keyup", {
        bubbles: true,
        cancelable: true,
        view: window,
        key: " ",
        code: "Space",
        keyCode: 32,
      });

      console.log(
        "TargetColor (one of three) detected: Simulating Space keypress."
      );

      // キャンバスにイベントをディスパッチ (keydown -> keyup の順)
      src.dispatchEvent(keyDownEvent);
      src.dispatchEvent(keyUpEvent);
    }
  }
});
