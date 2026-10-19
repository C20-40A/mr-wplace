import { defineConfig, devices } from "@playwright/test";

// Explicit, offline-only suite. No saved login state or extension is loaded.
export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: true,
  retries: 0,
  workers: 2,
  reporter: "list",
  use: {
    headless: true,
    serviceWorkers: "block",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"], defaultBrowserType: "chromium" },
    },
  ],
});
