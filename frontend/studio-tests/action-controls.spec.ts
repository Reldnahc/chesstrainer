import { expect, test } from "@playwright/test";

test("actual-size previews keep the production compact coach actions", async ({ page }) => {
  await page.goto("/");
  const actions = page.getByRole("region", { name: "Actual interface size previews" }).locator(".coach-actions button");
  await expect(actions).toHaveCount(2);
  for (const action of await actions.all()) {
    await expect(action).toBeDisabled();
    await expect(action).toHaveText("Show why");
    await expect(action).toHaveCSS("font-size", "12px");
    await expect(action).toHaveCSS("padding", "6px 10px");
    if (await action.isVisible()) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
