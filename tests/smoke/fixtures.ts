import { test as base, expect } from "@playwright/test";
import { build } from "esbuild";
import path from "node:path";

declare global {
  interface Window {
    smoke: typeof import("./harness");
  }
}

export const test = base.extend<{}, { smokeBundle: string }>({
  smokeBundle: [async ({}, use) => {
    const root = path.resolve(__dirname, "../..");
    const result = await build({
      absWorkingDir: root,
      entryPoints: ["tests/smoke/harness.ts"],
      bundle: true,
      write: false,
      format: "iife",
      globalName: "smoke",
      alias: { "@": "./src" },
      plugins: [{
        name: "skip-app-bootstrap",
        setup(builder) {
          builder.onResolve({ filter: /^@\/content$/ }, () => ({
            path: path.join(root, "src/core/bridge/gallery-bridge.ts"),
          }));
        },
      }],
    });
    await use(result.outputFiles[0].text);
  }, { scope: "worker" }],

  page: async ({ page, context, smokeBundle }, use) => {
    const requests: string[] = [];
    const errors: string[] = [];
    // Any network access is a test failure, even if it was successfully blocked.
    await context.route("**/*", route => {
      requests.push(route.request().url());
      return route.abort();
    });
    await context.routeWebSocket("**/*", socket => {
      requests.push(socket.url());
      socket.close();
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.setContent(`<main id="host"></main>`);
    // Only the host's basic modal/utility CSS is substituted. Component styles
    // remain real; this suite checks behavior, not the official site's theme.
    await page.addStyleTag({ content: `
      .hidden, .modal:not(.modal-open) { display: none; }
      .modal { position: fixed; inset: 0; z-index: 50; overflow: auto; }
      .modal-box { position: relative; margin: 1rem auto; background: white; }
      .modal-backdrop { display: none; }
      svg { width: 24px; height: 24px; }
      .relative { position: relative; } .absolute { position: absolute; }
    ` });
    await page.evaluate(() => {
      // Ephemeral extension API. Never reads the user's profile or storage.
      Object.assign(window, { chrome: {
        storage: { local: { get: async () => ({}), set: async () => {} } },
        runtime: {
          getURL: () => "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
          onMessage: { addListener() {}, removeListener() {} },
        },
      } });
    });
    await page.addScriptTag({ content: smokeBundle });
    await use(page);
    expect(requests, "Unexpected network access").toEqual([]);
    expect(errors, "Uncaught browser errors").toEqual([]);
  },
});

export { expect };
