import {test, expect} from "@playwright/test";

test("every current coach has a complete, varied, fact-preserving corpus", async ({page}, info) => {
  await page.goto("/");
  const status = page.getByTestId("corpus-status");
  await expect(status).toContainText("0 corpus errors");
  await expect(status).toContainText("0 writing collisions");
  const cards = page.getByRole("region", {name: "Writing laboratory"}).getByTestId("voice-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);
  const choices = await page.getByLabel("Writing scenario").locator("option").count();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (let index = 0; index < choices; index++) {
    await page.getByLabel("Writing scenario").selectOption(String(index));
    const lines = await cards.locator(".lab-voice-line").allTextContents();
    expect(lines).toHaveLength(count);
    expect(new Set(lines).size).toBe(count);
    expect(lines.every(line => line.length > 10 && line.length <= 330 && !line.includes("{"))).toBe(true);
  }
  await page.getByLabel("Writing scenario").selectOption({label: "brilliant"});
  const before = await cards.locator(".lab-voice-line").allTextContents();
  await page.getByRole("button", {name: "Next deterministic sample"}).click();
  expect(await cards.locator(".lab-voice-line").allTextContents()).not.toEqual(before);
  await page.getByLabel("Blind identity comparison").check();
  await expect(cards.first().getByRole("heading")).toHaveText("Voice 1");
  await expect(cards.locator(".coach-avatar")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `intelligence-test-results/blind-cast-${info.project.name}.png`, fullPage: true});
});
