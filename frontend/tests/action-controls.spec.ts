import { expect, test } from "@playwright/test";

test("primary and secondary destination actions share geometry and preserve keyboard navigation", async ({ page }) => {
  await page.goto("/study");
  const primary = page.getByRole("link", { name: "Start studying", exact: true });
  const secondary = page.getByRole("link", { name: "Explore openings", exact: true });
  await expect(primary).toBeVisible();
  await expect(secondary).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const primaryBox = (await primary.boundingBox())!;
  const secondaryBox = (await secondary.boundingBox())!;
  expect(primaryBox.height).toBeCloseTo(secondaryBox.height, 1);
  expect(primaryBox.height).toBeGreaterThanOrEqual(page.viewportSize()!.width <= 760 ? 44 : 42);
  await expect(secondary).toHaveAttribute("href", "/study/openings");
  await secondary.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/study/openings");
  await page.goBack();
  await expect(page).toHaveURL("/study");
});

test("Update games uses identical link and command sizing", async ({ page }) => {
  let connected = false;
  await page.route("**/api/providers/*/sync", route => route.fulfill({ json: {
    provider: new URL(route.request().url()).pathname.split("/")[3],
    username: connected ? "ActionFixture" : "", status: "not_started",
    checked_at: null, imported: 0, job_id: null, error: null,
  } }));
  await page.goto("/games");
  const setup = page.getByRole("link", { name: "Update games", exact: true });
  await expect(setup).toBeVisible();
  await expect(setup).toHaveAttribute("href", "/settings");
  await page.evaluate(() => document.fonts.ready);
  const linkBox = (await setup.boundingBox())!;
  connected = true;
  await page.reload();
  const update = page.getByRole("button", { name: "Update games", exact: true });
  await expect(update).toBeEnabled();
  const buttonBox = (await update.boundingBox())!;
  expect(buttonBox.width).toBeCloseTo(linkBox.width, 1);
  expect(buttonBox.height).toBeCloseTo(linkBox.height, 1);
  await expect(update).toHaveAttribute("type", "button");
});

test("shared command buttons remain commands and import forms still submit", async ({ page }) => {
  const imports: { method: string; body: string }[] = [];
  await page.route("**/api/jobs", route => route.fulfill({ json: [] }));
  await page.route("**/api/imports", route => {
    imports.push({ method: route.request().method(), body: route.request().postDataBuffer()!.toString() });
    return route.fulfill({ status: 422, json: { detail: "Import action fixture reached" } });
  });
  await page.goto("/settings");
  const open = page.getByRole("button", { name: "Import PGN", exact: true });
  await expect(open).toHaveAttribute("type", "button");
  await open.click();
  // This test exercises command/submit semantics. Import animation coverage
  // lives separately; wait for the expanding clip before targeting its footer.
  await expect.poll(() => page.locator(".import-form").evaluate(element =>
    element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length,
  )).toBe(0);
  const close = page.getByRole("button", { name: "Close import form", exact: true });
  await expect(close).toHaveAttribute("type", "button");
  await page.getByRole("button", { name: "Paste PGN text", exact: true }).click();
  const submit = page.getByRole("button", { name: "Import games", exact: true });
  await expect(submit).toHaveAttribute("type", "submit");
  await expect(submit).toBeDisabled();
  await page.getByLabel("PGN", { exact: true }).fill('[White "Fixture"]\n[Black "Opponent"]\n\n1. e4 e5 *');
  await page.getByLabel("Your username(s)").fill("Fixture");
  await expect(submit).toBeEnabled();
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/imports"
      && response.request().method() === "POST"),
    submit.click(),
  ]);
  expect(response.status()).toBe(422);
  await expect(page.getByRole("alert")).toContainText("Import action fixture reached");
  expect(imports).toHaveLength(1);
  expect(imports[0].method).toBe("POST");
  expect(imports[0].body).toContain('[White "Fixture"]');
  await close.click();
  await expect(page.getByLabel("PGN", { exact: true })).toHaveCount(0);
});

test("action links retain desktop modifier clicks", async ({ page, context }, info) => {
  test.skip(info.project.name !== "desktop", "Modifier click is a desktop interaction.");
  await page.goto("/study");
  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: "Explore openings", exact: true }).click({ modifiers: ["ControlOrMeta"] });
  const other = await opened;
  try {
    await expect(other).toHaveURL("/study/openings");
    await expect(page).toHaveURL("/study");
  } finally {
    await other.close();
  }
});
