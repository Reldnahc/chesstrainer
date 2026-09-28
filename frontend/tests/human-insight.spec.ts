import {test, expect, type Request} from "@playwright/test";
import {renderNeutral} from "../src/dialogue/neutral";
import {humanGames, humanIntent} from "./human-fixtures";
import {humanSourceNotes} from "../src/dialogue/humanClaims";

const cases = [
  ["natural_error", "human_natural_error", /natural mistake/i, "Natural mistake"],
  ["hard_find", "human_challenging", /hard move to find/i, "Hard find"],
  ["unusual_strong", "human_rare", /unusual.*strong/i, "Unusual but strong"],
  ["natural_best", "human_natural_best", /natural.*best move/i, "Natural best move"],
  ["natural_strong", "human_natural_strong", /natural.*strong/i, "Natural strong choice"],
  ["missed_defense", "difficult_defense", /d4.*hard.*find/i, "Hard defense missed"],
  ["defense_found", "human_defense_found", /hard.*find.*defense/i, "Hard defense found"],
] as const;

for (const [kind, code, phrase, label] of cases) {
  test(`${kind} keeps natural human wording separate from the objective grade`, () => {
    const game = humanGames[kind], saved = JSON.stringify(game);
    const intent = humanIntent(game), item = intent.claims.find(c => c.code === code);
    expect(item).toBeTruthy();
    const text = renderNeutral({...intent, claims: [item!]}).text;
    expect(text).toMatch(phrase);
    expect(text).not.toMatch(/human-model assessment|selected skill band|policy probability|%|players at your|you thought/i);
    expect(item!.evidence.some(ref => ref.id === game.frames[1].report!.human!.evidence_id)).toBe(true);
    expect(intent.decisions).toContain("domain_shift");
    expect(JSON.stringify(game)).toBe(saved);
    if (kind === "natural_strong") expect(text).not.toMatch(/best move/i);
    if (kind === "missed_defense") expect(text).toMatch(/would|was available|instead/i);
  });

  test(`${kind} has an accessible compact Maia insight in the actual review`, async ({page}) => {
    const game = humanGames[kind];
    await page.route(`**/api/games/${game.id}`, route => route.fulfill({json: game}));
    await page.route(`**/api/games/${game.id}/review`, route => route.fulfill({json: {job_id: game.job!.id, status: "completed"}}));
    await page.goto(`/games/${game.id}?ply=1`);
    const trigger = page.getByRole("button", {name: `Maia: ${label}`, exact: true});
    await expect(trigger).toBeVisible();
    await expect(page.locator(".coach-quality-name")).toHaveText(game.frames[1].report!.label);
    // Phone automation scrolls a below-fold trigger into view. Compare document
    // coordinates, so scrolling is not mistaken for a board/bubble layout shift.
    const geometry = (selector: string) => page.locator(selector).evaluate(element => {
      const rect = element.getBoundingClientRect();
      return {x: rect.x + scrollX, y: rect.y + scrollY, width: rect.width, height: rect.height};
    });
    const boardBefore = await geometry(".review-board-row");
    const bubbleBefore = await geometry(".coach-speech");
    await trigger.click();
    const detail = page.getByRole("dialog", {name: "Maia insight"});
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(/estimate|estimates/);
    await expect(detail).toContainText("Lichess blitz");
    await expect(detail).toContainText(/different site or time control/i);
    expect(await geometry(".review-board-row")).toEqual(boardBefore);
    expect(await geometry(".coach-speech")).toEqual(bubbleBefore);
    await page.keyboard.press("ArrowLeft");
    await expect(trigger).toBeVisible();
    await expect(detail).toBeVisible();
    await expect(page.locator(".coach-message")).not.toContainText(/Book recognition|human-model assessment|selected skill band|searched advantage/);
    await page.keyboard.press("Escape");
    await expect(detail).not.toBeVisible();
    // Navigating away closes the old insight; it cannot describe the next board.
    await trigger.click();
    await page.getByRole("button", {name: "Previous move", exact: true}).click();
    await expect(detail).not.toBeVisible();
    await expect(trigger).not.toBeVisible();
  });
}

test("missing, stale, forced and opponent policy cannot become learner achievements", () => {
  for (const kind of ["missing", "unavailable", "stale", "wrong-move", "forced", "opponent"] as const) {
    const game = structuredClone(humanGames.hard_find), report = game.frames[1].report!;
    if (kind === "missing") report.human = null;
    if (kind === "unavailable") report.human!.status = "unavailable";
    if (kind === "stale") report.practical!.human_evidence_id = "previous-generation";
    if (kind === "wrong-move") report.human!.played!.uci = "d2d4";
    if (kind === "forced") report.practical!.best_find_difficulty = "forced";
    if (kind === "opponent") game.orientation = "black";
    expect(humanIntent(game).claims.some(c => c.code.startsWith("human_") || c.code === "difficult_defense"), kind).toBe(false);
  }
});

test("source context preserves domain uncertainty without turning policy into population odds", () => {
  const report = structuredClone(humanGames.natural_best.frames[1].report!);
  expect(humanSourceNotes(report).notes.join(" ")).toContain("different site or time control");
  report.human!.domain.alignment = "unknown";
  report.practical!.limitations.push("rating_fallback");
  expect(humanSourceNotes(report).notes.join(" ")).toContain("source or time control is unknown");
  expect(humanSourceNotes(report).notes.join(" ")).toContain("adds uncertainty");
  report.human!.domain.alignment = "related";
  const notes = humanSourceNotes(report).notes.join(" ");
  expect(notes).toContain("not measured player success rates");
  expect(notes).not.toContain("different site");
  report.human!.provenance!.provider = "future-provider";
  expect(humanSourceNotes(report).name).toBe("Human model");
  expect(humanSourceNotes(report).notes.join(" ")).not.toMatch(/Maia|Lichess/);
});

test("visible Maia insight survives coach selection and reload without new analysis", async ({page}) => {
  const game = humanGames.natural_error, original = JSON.stringify(game);
  const searches: string[] = [];
  const observe = (request: Request) => {
    if (request.method() === "POST" && /\/(analyze|analysis)$/.test(request.url())) searches.push(request.url());
  };
  page.on("request", observe);
  await page.route(`**/api/games/${game.id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${game.id}/review`, route => route.fulfill({json: {job_id: game.job!.id, status: "completed"}}));
  await page.request.put("/api/preferences/coach", {data: {coach_id: "classic", motion: "still"}});
  const trigger = page.getByRole("button", {name: "Maia: Natural mistake", exact: true});
  const detail = page.getByRole("dialog", {name: "Maia insight"});
  const wording = detail.locator("[data-utterance]");
  const reopen = async (action: () => Promise<unknown>) => {
    await Promise.all([
      page.waitForResponse(r => r.request().method() === "POST" && r.url().endsWith(`/games/${game.id}/review`))
        .then(async response => expect(await response.json()).toEqual({job_id: game.job!.id, status: "completed"})),
      action(),
    ]);
    await trigger.click();
    await expect(detail).toBeVisible();
  };
  try {
    await reopen(() => page.goto(`/games/${game.id}?ply=1`));
    const before = await wording.innerText(), intent = await wording.getAttribute("data-intent");
    await page.keyboard.press("Escape");
    await page.getByRole("link", {name: "Settings", exact: true}).click();
    await page.getByRole("button", {name: "Women", exact: true}).click();
    const choice = page.getByRole("radio", {name: "Quiet analyst", exact: true});
    await choice.click();
    await expect(choice).toBeChecked();
    await expect(page.getByLabel("Coach motion", {exact: true})).toBeEnabled();
    await reopen(() => page.goBack());
    await expect(wording).toHaveAttribute("data-dialogue-coach", "woman-analyst");
    await expect(wording).not.toHaveText(before);
    await expect(wording).toHaveAttribute("data-intent", intent!);
    const selected = await wording.innerText();
    await reopen(() => page.reload());
    await expect(wording).toHaveText(selected);
    await expect(wording).toHaveAttribute("data-intent", intent!);
    await expect(wording).toHaveAttribute("data-dialogue-coach", "woman-analyst");
    expect(JSON.stringify(game)).toBe(original);
    expect(searches).toEqual([]);
  } finally {
    page.off("request", observe);
    await page.request.put("/api/preferences/coach", {data: {coach_id: "classic", motion: "natural"}});
  }
});
