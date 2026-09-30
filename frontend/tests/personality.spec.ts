import {test, expect, type Request} from "@playwright/test";
import {renderDialogue, renderNeutral} from "../src/dialogue/neutral";
import {claim, makeIntent} from "../src/dialogue/model";
import {neutralPersonality} from "../src/dialogue/personality";
import {storyteller} from "../src/dialogue/characters/storyteller";
import {analyst} from "../src/dialogue/characters/analyst";

const story = {id: "classic", personality: storyteller};
const quiet = {id: "woman-analyst", personality: analyst};

test("personality changes language and delivery without changing factual intensity or evidence", () => {
  const intent = makeIntent("fixed-position", "blunder", "game", "blunder", [
    claim("allowed_mate", {opponent: "Black", reply: "The reply is Qh4#."}, 100, [{source: "stockfish", id: "objective", field: "score"}]),
  ]);
  const saved = JSON.stringify(intent);
  const voices = [story, quiet].map(coach => renderDialogue(intent, coach));
  expect(voices[0].text).not.toBe(voices[1].text);
  for (const line of voices) {
    expect(line.text).toContain("Qh4#");
    expect(line.text).toMatch(/\bforce(?:d)? (?:check)?mate\b/i);
    expect(line.text).toContain("Black");
    expect(line.intentId).toBe(intent.id);
    expect(line.expression).toBe("blunder");
    expect(line.priority).toBe(100);
    expect(line.intensity).toBe(1);
    expect(line.interruptible).toBe(false);
  }
  expect(JSON.stringify(intent)).toBe(saved);
  expect(renderDialogue(intent, story)).toEqual(voices[0]);
});

test("new or partial personalities have complete safe fallback and registry remains the identity source", () => {
  const intent = makeIntent("position", "good", "game", "good", [claim("good")]);
  const neutral = renderNeutral(intent);
  const unknown = renderDialogue(intent, {id: "future-coach"});
  expect(unknown.text).toBe(neutral.text);
  const malformed = renderDialogue(intent, {id: "future", personality: {...neutralPersonality, templates: {good: ["{absent}"]}}});
  expect(malformed.text).toBe(neutral.text);
  expect(malformed.trace.variants[0].source).toBe("neutral-1");
  for (const coach of [story, quiet]) {
    expect(coach.personality.bible.correction).toBeTruthy();
    expect(renderDialogue(intent, coach).coachId).toBe(coach.id);
  }
});

test("saved coach selection changes reviewed wording without new searches or altered facts", async ({page}, info) => {
  test.setTimeout(90_000);
  const {id} = await (await page.request.post(`/__test/game-review-fixture/personality-${info.project.name}`)).json();
  await page.request.put("/api/preferences/coach", {data: {coach_id: "classic", motion: "still"}});
  await page.goto(`/games/${id}?ply=3`);
  const line = page.locator(".coach-message [data-utterance]");
  await expect(line).toContainText(/\bforce(?:d)? (?:check)?mate\b/i, {timeout: 60_000});
  await expect(line).toContainText("Black");
  await expect(line).toContainText("Qh4#");
  await expect(page.locator(".game-summary caption")).toContainText("Complete game", {timeout: 60_000});
  const text = await line.innerText(), intentId = await line.getAttribute("data-intent");
  const before = await (await page.request.get(`/api/games/${id}`)).json();
  const searches: string[] = [];
  const refreshRequests: string[] = [];
  const observeRequest = (request: Request) => {
    if (request.method() !== "POST") return;
    if (/\/(analysis|analyze)$/.test(request.url())) searches.push(request.url());
    if (request.url().endsWith(`/games/${id}/review`)) refreshRequests.push(request.url());
  };
  page.on("request", observeRequest);
  const reopen = async (navigate: () => Promise<unknown>) => {
    // Register before navigation and consume the body within the awaited task.
    // Both back navigation and reload perform the completed-review handshake.
    await Promise.all([
      page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/games/${id}/review`))
        .then(async response => {
          expect(response.ok()).toBe(true);
          expect(await response.json()).toEqual({status: "completed", job_id: before.job.id});
        }),
      navigate(),
    ]);
  };
  try {
    await page.getByRole("link", {name: "Settings", exact: true}).click();
    await page.getByRole("navigation", {name: "Settings sections"}).getByRole("link", {name: "Coach & sound", exact: true}).click();
    const choice = page.getByRole("radio", {name: "Iris", exact: true});
    await choice.click();
    await expect(choice).toBeChecked();
    await expect(page.getByLabel("Coach motion", {exact: true})).toBeEnabled();
    await page.goBack();
    await expect(page).toHaveURL("/settings");
    await reopen(() => page.goBack());
    await expect(line).toHaveAttribute("data-dialogue-coach", "woman-analyst");
    await expect(line).not.toHaveText(text);
    await expect(line).toHaveAttribute("data-intent", intentId!);
    const after = await (await page.request.get(`/api/games/${id}`)).json();
    expect(after.frames).toEqual(before.frames);
    expect(after.context).toEqual(before.context);
    expect(searches).toEqual([]);
    // Reopening has an existing idempotent model/refinement refresh handshake.
    // A preference change must leave it completed, never queue another search.
    expect(after.job).toEqual(before.job);
    const selectedText = await line.innerText();
    await reopen(() => page.reload());
    await expect(line).toHaveAttribute("data-dialogue-coach", "woman-analyst");
    await expect(line).toHaveText(selectedText);
    await expect(line).toHaveAttribute("data-intent", intentId!);
    const reloaded = await (await page.request.get(`/api/games/${id}`)).json();
    expect(reloaded.frames).toEqual(before.frames);
    expect(reloaded.context).toEqual(before.context);
    expect(reloaded.job).toEqual(before.job);
    expect(refreshRequests).toHaveLength(2);
    expect(searches).toEqual([]);
  } finally {
    page.off("request", observeRequest);
    await page.request.put("/api/preferences/coach", {data: {coach_id: "classic", motion: "natural"}});
  }
});
