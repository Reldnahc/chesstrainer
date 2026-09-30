import { test, expect } from "@playwright/test";

// Deliberately independent of the registry: catch omissions, duplicates and
// reordered groups instead of teaching the test whatever the registry contains.
const castGroups = [
  { label: "Humans", ids: ["classic", "man-host", "man-expert", "man-partner", "woman-captain", "woman-analyst", "woman-spark", "woman-blonde", "human-boy", "human-girl"] },
  { label: "Dogs", ids: ["dog-gentle", "dog-corgi", "dog-collie", "dog-puppy"] },
  { label: "Cats", ids: ["cat-tuxedo", "cat-black", "cat-kitten"] },
  { label: "Other animals", ids: ["gorilla", "raccoon", "frog", "capybara"] },
  { label: "Fantasy", ids: ["unicorn", "wizard", "dragon", "ghost"] },
  { label: "Sci-Fi", ids: ["alien", "robot"] },
  { label: "Silly & conceptual", ids: ["slime", "mushroom", "living-pawn"] },
] as const;
const castIds = castGroups.flatMap(group => [...group.ids]);
const retainedNames = [
  "Walter", "Desmond", "Kenji", "Arjun",
  "Mara", "Iris", "Zoe", "Poppy",
  "Alfie", "Waffles", "Scout",
  "Felix", "Juniper",
];

test("every registered coach can be chosen and restored in a real game", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const preferences = "/api/preferences/coach";
  await page.request.put(preferences, {
    data: { coach_id: "classic", motion: "still" },
  });
  const contract = await (await page.request.get("/openapi.json")).json();
  const allowed =
    contract.components.schemas.CoachPreferences.properties.coach_id.enum;
  const { id } = await (
    await page.request.post(
      `/__test/game-review-fixture/selection-${info.project.name}`,
    )
  ).json();
  try {
    await page.goto("/settings?section=coach");
    const choices = await page.getByRole("radio").evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).value),
    );
    expect(choices).toEqual(castIds);
    expect([...allowed].sort()).toEqual([...castIds].sort());
    await expect(page.locator(".coach-group-label")).toHaveCount(0);
    await expect(page.getByRole("group", {name: "Coach collections"})).toHaveCount(0);
    await expect(page.locator(".coach-settings").getByRole("tab")).toHaveCount(0);
    for (const name of retainedNames) {
      await expect(page.getByRole("radio", {name, exact: true})).toBeVisible();
    }
    for (const coachId of castIds) {
      const radio = page.locator(`input[name="coach"][value="${coachId}"]`);
      await expect(radio).toBeVisible();
      // This controlled radio changes only after the preference save completes.
      await radio.click();
      await expect(radio).toBeChecked();
      await expect(page.getByLabel("Coach motion", { exact: true })).toBeEnabled();
      expect(await (await page.request.get(preferences)).json()).toEqual({
        coach_id: coachId,
        motion: "still",
      });
      await page.reload();
      await expect(radio).toBeChecked();
      await page.goto(`/games/${id}?ply=3`);
      const avatar = page.locator(".review-coach .coach-avatar");
      await expect(avatar).toHaveAttribute("data-coach", coachId);
      await expect(avatar).toHaveAttribute("data-expression", "blunder", {
        timeout: 30000,
      });
      await expect(avatar.locator("svg")).toBeVisible();
      await page.getByRole("link", { name: "Settings", exact: true }).click();
      await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Coach & sound", exact: true }).click();
      await expect(radio).toBeChecked();
    }
    await page.screenshot({
      path: `test-results/coach-selection-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await page.request.put(preferences, {
      data: { coach_id: "classic", motion: "natural" },
    });
  }
});

test("the compact picker shows six by five cards on desktop and fits narrow phones", async ({page}, info) => {
  await page.setViewportSize({width: 1200, height: 900});
  await page.goto("/settings?section=coach");
  const grid = page.locator(".coach-options");
  await expect(grid.getByRole("radio")).toHaveCount(castIds.length);
  const cards = grid.locator(".coach-option");
  await expect(cards).toHaveCount(30);
  for (const card of await cards.all()) {
    await expect(card).toBeVisible();
    await expect(card.locator(".coach-option-description")).not.toBeEmpty();
  }
  await expect(page.locator(".coach-settings h3, .coach-group-label")).toHaveCount(0);
  const geometry = () => cards.evaluateAll(elements => elements.map(element => {
    const {left, top, width, height} = element.getBoundingClientRect();
    return {left, top, width, height};
  }));
  const desktop = await geometry();
  expect(new Set(desktop.map(card => Math.round(card.left))).size).toBe(6);
  expect(new Set(desktop.map(card => Math.round(card.top))).size).toBe(5);
  expect(desktop.every(card => card.height < 125)).toBe(true);
  await page.locator('.coach-settings').screenshot({path: `test-results/coach-picker-desktop-${info.project.name}.png`});
  await page.setViewportSize({width: 390, height: 844});
  const phone = await geometry();
  expect(new Set(phone.map(card => Math.round(card.left))).size).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({width: 320, height: 700});
  const layout = await geometry();
  expect(layout[0].top).toBe(layout[1].top);
  expect(layout[0].left).toBeLessThan(layout[1].left);
  expect(layout[2].top).toBeGreaterThan(layout[0].top);
  expect(layout.every(card => card.width >= 44 && card.height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/coach-picker-320-${info.project.name}.png`, fullPage: true});
});

test("legacy and unknown saved coaches display a selected safe fallback without a preference write", async ({page}) => {
  const writes: string[] = [];
  let savedCoach = "dog-sunny";
  await page.route("**/api/preferences/coach", route => {
    if (route.request().method() !== "GET") writes.push(route.request().postData() ?? "");
    return route.fulfill({json: {coach_id: savedCoach, motion: "still"}});
  });
  for (const [legacy, fallback] of [
    ["dog-sunny", "dog-puppy"], ["cat-tabby", "cat-kitten"],
    ["cat-calico", "cat-kitten"], ["future-coach", "classic"],
  ]) {
    savedCoach = legacy;
    await page.goto("/settings?section=coach");
    const selected = page.locator('.coach-option input:checked');
    await expect(selected).toHaveValue(fallback);
    await expect(page.locator('.coach-option:has(input:checked) .coach-avatar')).toHaveAttribute('data-coach', fallback);
    await expect(page.getByLabel("Coach motion", {exact: true})).toHaveValue("still");
  }
  expect(writes).toEqual([]);
});

test("switching coaches carries semantic feedback into SRS and saved explanations", async ({
  page,
}, info) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "dog-collie", motion: "natural" },
  });
  try {
    const fixture = await (
      await page.request.post(
        `/__test/review-explanation-fixture/selected-${info.project.name}`,
      )
    ).json();
    await page.goto(`/?exercise=${fixture.exercise_id}`);
    const avatar = page.locator(".review-coach .coach-avatar");
    await expect(avatar).toHaveAttribute("data-coach", "dog-collie");
    await expect(avatar).toHaveAttribute("data-expression", "neutral");
    const board = page.locator(".board-shell");
    const play = async (uci: string) => {
      await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
      await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
    };
    await play(fixture.wrong);
    await expect(avatar).toHaveAttribute("data-expression", "mistake");
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(avatar).toHaveAttribute("data-expression", "encouraging");
    await play(fixture.best);
    await expect(avatar).toHaveAttribute("data-expression", "recovered");
    await page.getByRole("button", { name: "Show why", exact: true }).click();
    await expect(avatar).toHaveAttribute("data-expression", "explaining");
    await page.screenshot({
      path: `test-results/coach-selected-practice-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await page.request.put("/api/preferences/coach", {
      data: { coach_id: "classic", motion: "natural" },
    });
  }
});
