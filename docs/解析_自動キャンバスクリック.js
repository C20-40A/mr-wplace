const src = document.querySelector("canvas.maplibregl-canvas");

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
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const d = ctx.getImageData(x, y, 1, 1).data;
  // console.log(`(${x},${y})`, d);

  // 赤のホバー色
  const isTargetColor =
    d[0] === 235 && d[1] === 82 && d[2] === 82 && d[3] === 255;

  let lastClickTime = 0;
  const CLICK_COOLDOWN = 500; // 500ms

  if (isTargetColor) {
    const now = Date.now();
    if (now - lastClickTime <= CLICK_COOLDOWN) return;
    lastClickTime = now;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: e.clientX,
      clientY: e.clientY,
    });
    console.log("TargetColor clicked");
    src.dispatchEvent(clickEvent);
  }
});
