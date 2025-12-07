// Performance monitor for JS heap size (Chrome only)

const formatBytes = (bytes: number): string => {
  const mb = bytes / 1024 / 1024;
  return mb.toFixed(1);
};

export const setupPerformanceMonitor = () => {
  // Check if performance.memory is available (Chrome only)
  if (!(performance as any).memory) {
    console.log("🧑‍🎨: performance.memory not available (not Chrome)");
    return;
  }

  const init = () => {
    if (!document.body) {
      setTimeout(init, 100);
      return;
    }

    // Create monitor element
    const monitor = document.createElement("div");
    monitor.style.cssText = `
      position: fixed;
      top: 4px;
      left: 4px;
      background: rgba(0, 0, 0, 0.85);
      color: #fff;
      font-family: monospace;
      font-size: 11px;
      padding: 4px 6px;
      border-radius: 3px;
      z-index: 999999;
      pointer-events: none;
      line-height: 1.3;
    `;

    document.body.appendChild(monitor);

    // Update every 1 second
    const update = () => {
      const mem = (performance as any).memory;
      if (!mem) return;

      const used = formatBytes(mem.usedJSHeapSize);
      const limit = formatBytes(mem.jsHeapSizeLimit);
      monitor.textContent = `${used}/${limit}MB`;
    };

    update();
    setInterval(update, 1000);

    console.log("🧑‍🎨: Performance monitor started");
  };

  init();
};
