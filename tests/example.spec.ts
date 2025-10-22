import { test, expect } from "@playwright/test";

test("can pass", async ({ page }) => {
  await expect(page).toHaveTitle(/.*/);
});
