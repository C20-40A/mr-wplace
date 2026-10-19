import { test, expect } from "./fixtures";

test("gallery actions survive redraw, close/reopen and host replacement", async ({ page }) => {
  await page.evaluate(() => {
    const { GalleryUI, GalleryRouter, ImageGridComponent, createGalleryButton, setupElementObserver } = window.smoke;
    const router = new GalleryRouter();
    const ui = new GalleryUI(router);
    let grid: InstanceType<typeof ImageGridComponent>;
    let toggles = 0;
    let details = 0;
    const render = () => {
      ui.showModal();
      router.initialize("list");
      grid = new ImageGridComponent(ui.getContainer(), {
        items: [{
          key: "sample", title: "Smoke sample", timestamp: 1,
          width: 1, height: 1, drawEnabled: false,
          drawPosition: { TLX: 1, TLY: 2, PxX: 3, PxY: 4 },
          thumbnail: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        }],
        onDrawToggle: () => {
          document.body.dataset.toggles = String(++toggles);
          grid.updateOptions({});
        },
        onImageClick: () => { document.body.dataset.details = String(++details); },
        onAddClick: () => router.navigate("image-editor"),
        tutorialAnchor: ui.getModalElements()!.minimizeButton,
      });
      grid.render();
    };
    ui.setOnModalClose(() => grid.destroy());
    setupElementObserver([{
      id: "gallery-btn",
      getTargetElement: () => document.getElementById("host"),
      createElement: host => {
        const button = createGalleryButton();
        button.onclick = render;
        host.append(button);
      },
    }]);
  });

  for (let cycle = 1; cycle <= 2; cycle++) {
    await expect(page.locator("#gallery-btn")).toHaveCount(1);
    await page.locator("#gallery-btn").click();
    await expect(page.getByText("Smoke sample")).toBeVisible();
    await page.locator('[data-draw-toggle="sample"]').click();
    await expect(page.locator("body")).toHaveAttribute("data-toggles", String(cycle));
    // Toggle must not bubble into the image detail handler.
    await expect(page.locator("body")).not.toHaveAttribute("data-details");
    await page.locator("#wplace-studio-gallery-modal-minimize-btn").click();
    await expect(page.locator("#wplace-studio-gallery-modal-content")).toBeHidden();
    await page.locator("#wplace-studio-gallery-modal-minimize-btn").click();
    await expect(page.getByText("Smoke sample")).toBeVisible();
    await page.locator("#wps-gallery-add-btn").click();
    await expect(page.locator("#wplace-studio-gallery-modal-title")).toHaveText("Image Editor");
    await page.locator("#wplace-studio-gallery-modal-back-btn").click();
    await expect(page.locator("#wplace-studio-gallery-modal-title")).toHaveText("Gallery");
    await page.locator("#wplace-studio-gallery-modal-close-btn").click();
    await expect(page.locator("#wplace-studio-gallery-modal")).toHaveCount(0);
    // Simulate the official UI replacing its toolbar after navigation.
    await page.evaluate(() => {
      const replacement = document.createElement("main");
      replacement.id = "host";
      document.getElementById("host")!.replaceWith(replacement);
    });
  }
  await page.locator("#gallery-btn").click();
  await page.locator(".gallery-item > button").first().click();
  await expect(page.locator("body")).toHaveAttribute("data-details", "1");
  await page.keyboard.press("Escape");
  await expect(page.locator("#wplace-studio-gallery-modal")).toHaveCount(0);
});

test("gallery metadata reaches the overlay in layer order; temporary hiding is reversible", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const coords = { TLX: 1, TLY: 2, PxX: 3, PxY: 4 };
    const items = [
      { id: "front", coords, zIndex: 5, visible: true },
      { id: "unplaced", zIndex: 0, visible: true },
      { id: "back", coords, zIndex: 1, visible: false },
    ];
    const received: unknown[] = [];
    // Only the storage peer is simulated; the real request/response bridge runs.
    window.addEventListener("message", event => {
      const message = event.data;
      if (message.source === "mr-wplace-gallery-v2-get-all") {
        // A stale response must not resolve the current request.
        window.postMessage({ source: message.source + "-response", requestId: "stale", result: [] }, "*");
        window.postMessage({ source: message.source + "-response", requestId: message.requestId, result: items }, "*");
      }
    });
    const send = async (action: () => Promise<void>) => {
      const delivered = new Promise<void>(resolve => {
        const listener = (event: MessageEvent) => {
          if (event.data.source !== "mr-wplace-gallery-images-v2") return;
          received.push(event.data.items);
          window.removeEventListener("message", listener);
          resolve();
        };
        window.addEventListener("message", listener);
      });
      await action();
      await delivered;
    };
    await send(() => window.smoke.sendGalleryImagesToInject());
    await send(() => window.smoke.setGalleryImageTemporarilyHidden("front", true));
    await send(() => window.smoke.setGalleryImageTemporarilyHidden("front", false));
    return { received, savedVisible: items[0].visible };
  });
  const back = expect.objectContaining({ id: "back", visible: false });
  const front = expect.objectContaining({ id: "front", visible: true });
  expect(result.received).toEqual([
    [back, front],
    [back, expect.objectContaining({ id: "front", visible: false })],
    [back, front],
  ]);
  expect(result.savedVisible).toBe(true);
});
