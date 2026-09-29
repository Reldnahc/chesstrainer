import { expect, test } from "@playwright/test";

test("expression filters use application choice controls without changing the inspected reaction", async ({ page }) => {
  await page.goto("/?coach=classic&family=storyteller&expression=brilliant");
  const filters = page.getByRole("group", { name: "Filter expressions", exact: true });
  const expression = page.getByRole("combobox", { name: "Expression", exact: true });
  await expect(filters.getByRole("button")).toHaveText(["All expressions", "Good ideas", "Hard moments", "Between moves"]);
  await expect(expression).toHaveValue("brilliant");
  const collection = page.locator(".studio-expression-grid");

  for (const [name, count, present, absent] of [
    ["Good ideas", 8, "brilliant", "blunder"],
    ["Hard moments", 7, "blunder", "brilliant"],
    ["Between moves", 5, "thinking", "brilliant"],
  ] as const) {
    const selected = filters.getByRole("button", { name, exact: true });
    await selected.click();
    await expect(filters.getByRole("button", { pressed: true })).toHaveCount(1);
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    await expect(collection.getByRole("button")).toHaveCount(count);
    await expect(collection.locator(`[data-expression="${present}"]`)).toHaveCount(1);
    await expect(collection.locator(`[data-expression="${absent}"]`)).toHaveCount(0);
    await expect(expression).toHaveValue("brilliant");
    await expect(selected).toHaveCSS("border-radius", "6px");
    await expect(selected).toHaveCSS("color", "rgb(255, 128, 89)");
    expect((await selected.boundingBox())!.height).toBeGreaterThanOrEqual(42);
  }
  await filters.getByRole("button", { name: "All expressions", exact: true }).click();
  await expect(collection.getByRole("button")).toHaveCount(20);
  await collection.getByRole("button", { name: "Inspect Blunder", exact: true }).click();
  await expect(expression).toHaveValue("blunder");
  await expect(filters.getByRole("button", { name: "All expressions", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.setViewportSize({ width: 320, height: 700 });
  await filters.scrollIntoViewIfNeeded();
  for (const button of await filters.getByRole("button").all()) {
    await expect(button).toBeInViewport();
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
