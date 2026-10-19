import { test, expect } from "./fixtures";

test("saved background waits for layers, restores correctly and cancels obsolete subscriptions", async ({ page }) => {
  const result = await page.evaluate(() => {
    const listeners = new Set<() => void>();
    let layers: { id: string; type: string }[] = [];
    const paint = new Map<string, unknown>([["base:background-color", "#eeeeee"]]);
    const layout = new Map<string, unknown>();
    const emit = () => { for (const listener of [...listeners]) listener(); };
    // Synchronous styledata from setters deliberately detects recursive updates.
    const map = {
      getStyle: () => ({ layers }),
      getLayer: (id: string) => layers.find(layer => layer.id === id),
      on: (_event: string, listener: () => void) => listeners.add(listener),
      off: (_event: string, listener: () => void) => listeners.delete(listener),
      getPaintProperty: (id: string, key: string) => paint.get(`${id}:${key}`),
      setPaintProperty: (id: string, key: string, value: unknown) => {
        paint.set(`${id}:${key}`, value); emit();
      },
      getLayoutProperty: (id: string, key: string) => layout.get(`${id}:${key}`),
      setLayoutProperty: (id: string, key: string, value: unknown) => {
        layout.set(`${id}:${key}`, value); emit();
      },
    };
    Object.assign(window, { mrWplace: { wplaceMap: map } });
    const { changeBackgroundColor } = window.smoke;
    changeBackgroundColor("#123456");
    emit();
    const waiting = listeners.size;
    layers = [{ id: "base", type: "background" }, { id: "roads", type: "line" }];
    emit();
    const stillWaiting = listeners.size;
    layers.push({ id: "pixel-art-layer", type: "raster" });
    emit();
    const applied = {
      color: paint.get("base:background-color"),
      roads: layout.get("roads:visibility"),
      listeners: listeners.size,
    };
    changeBackgroundColor(null);
    const restored = {
      color: paint.get("base:background-color"),
      roads: layout.get("roads:visibility"),
    };
    layers = [];
    changeBackgroundColor("#111111");
    changeBackgroundColor("#222222");
    const replaced = listeners.size;
    changeBackgroundColor(null);
    const cancelled = listeners.size;
    layers = [{ id: "base", type: "background" }, { id: "pixel-art-layer", type: "raster" }];
    emit();
    const afterCancel = paint.get("base:background-color");
    layers = [];
    changeBackgroundColor("#111111");
    changeBackgroundColor("#222222");
    layers = [{ id: "base", type: "background" }, { id: "pixel-art-layer", type: "raster" }];
    emit();
    return { waiting, stillWaiting, applied, restored, replaced, cancelled, afterCancel,
      latestColor: paint.get("base:background-color"), finalListeners: listeners.size };
  });
  expect(result).toEqual({
    waiting: 1, stillWaiting: 1,
    applied: { color: "#123456", roads: "none", listeners: 0 },
    restored: { color: "#eeeeee", roads: "visible" },
    replaced: 1, cancelled: 0, afterCancel: "#eeeeee",
    latestColor: "#222222", finalListeners: 0,
  });
});
