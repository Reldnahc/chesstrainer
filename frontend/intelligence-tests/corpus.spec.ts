import {test, expect} from "@playwright/test";
import {renderCoaches} from "./render-coaches";
import {exampleIntent, comparisonExamples, writingExamples} from "../intelligence-lab/examples";

test("every current coach has a complete, varied, fact-preserving corpus", async ({page}, info) => {
  await page.goto("/");
  const status = page.getByTestId("corpus-status");
  await expect(status).toContainText("0 corpus errors");
  await expect(status).toContainText("0 writing collisions");
  const cards = page.getByRole("region", {name: "Writing laboratory"}).getByTestId("voice-card");
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);
  await expect(cards.locator("p.lab-voice-line[aria-live=off][data-utterance][data-intent][data-dialogue-coach]")).toHaveCount(count);
  const choices = await page.getByLabel("Writing scenario").locator("option").count();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (let index = 0; index < choices; index++) {
    await page.getByLabel("Writing scenario").selectOption(String(index));
    const lines = await cards.locator(".lab-voice-line").allTextContents();
    expect(lines).toHaveLength(count);
    // Identical terse facts are sometimes the right wording. Whole-corpus and
    // structural comparisons exercise identity without demanding 30 synonyms.
    expect(lines.every(line => line.trim().length > 0 && line.length <= 330 && !line.includes("{"))).toBe(true);
  }
  await page.getByLabel("Writing scenario").selectOption({label: "brilliant"});
  const before = await cards.locator(".lab-voice-line").allTextContents();
  await page.getByRole("button", {name: "Next deterministic sample"}).click();
  expect(await cards.locator(".lab-voice-line").allTextContents()).not.toEqual(before);
  await page.getByLabel("Blind identity comparison").check();
  await expect(cards.first().getByRole("heading")).toHaveText("Voice 1");
  await expect(cards.locator(".coach-avatar")).toHaveCount(0);
  await page.getByLabel("Compare ten shared situations together").check();
  await expect(cards.first().locator(".lab-voice-line")).toHaveCount(10);
  await expect(cards.locator("dl.lab-voice-samples > div > dd.lab-voice-line[aria-live=off][data-utterance][data-intent][data-dialogue-coach]")).toHaveCount(count * comparisonExamples.length);
  const firstCoachId = await cards.first().locator(".lab-voice-line").first().getAttribute("data-dialogue-coach");
  for (const [index, example] of comparisonExamples.entries()) {
    const sample = (await renderCoaches(page, exampleIntent(example, 1))).find(utterance => utterance.coachId === firstCoachId)!;
    const entry = cards.first().locator(".lab-voice-samples > div").nth(index);
    await expect(entry.locator("dt")).toHaveText(writingExamples[example].label ?? writingExamples[example].purpose.replaceAll("_", " "));
    await expect(entry.locator("dd")).toHaveText(sample.text);
    await expect(entry.locator("dd")).toHaveAttribute("data-utterance", sample.id);
    await expect(entry.locator("dd")).toHaveAttribute("data-intent", sample.intentId);
  }
  await expect(cards.first().getByRole("heading")).toHaveText("Voice 1");
  await expect(cards.locator(".coach-avatar")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `intelligence-test-results/blind-cast-${info.project.name}.png`, fullPage: true});
});
