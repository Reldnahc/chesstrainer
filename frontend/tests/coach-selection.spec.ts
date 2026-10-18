import { test, expect } from "./helpers/browserTest";

// Deliberately independent of the registry: catch omissions, duplicates and
// reordered groups instead of teaching the test whatever the registry contains.
const castGroups = [
  {
    label: "Humans",
    ids: [
      "classic",
      "man-host",
      "man-expert",
      "man-partner",
      "woman-captain",
      "woman-analyst",
      "woman-spark",
      "woman-blonde",
      "human-boy",
      "human-girl",
    ],
  },
  { label: "Dogs", ids: ["dog-gentle", "dog-corgi", "dog-collie", "dog-puppy"] },
  { label: "Cats", ids: ["cat-tuxedo", "cat-black", "cat-kitten"] },
  { label: "Other animals", ids: ["gorilla", "raccoon", "frog", "capybara"] },
  { label: "Fantasy", ids: ["unicorn", "wizard", "dragon", "ghost"] },
  { label: "Sci-Fi", ids: ["alien", "robot"] },
  { label: "Silly & conceptual", ids: ["slime", "mushroom", "living-pawn"] },
] as const;
const castIds = castGroups.flatMap(group => [...group.ids]);
const retainedNames = [
  "Walter",
  "Femi",
  "Jun",
  "Arjun",
  "Tamar",
  "Marisol",
  "Réka",
  "Ingrid",
  "Alfie",
  "Waffles",
  "Scout",
  "Felix",
  "Juniper",
];

test("every registered coach can be chosen and restored in a real game", async ({ page }, info) => {
  test.setTimeout(180000);
  const preferences = "/api/preferences/coach";
  await page.request.put(preferences, {
    data: { coach_id: "classic", motion: "still" },
  });
  const contract = await (await page.request.get("/openapi.json")).json();
  const allowed = contract.components.schemas.CoachPreferences.properties.coach_id.enum;
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/selection-${info.project.name}`)
  ).json();
  try {
    await page.goto("/settings?section=coach");
    const choices = await page
      .getByRole("radio")
      .evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value));
    expect(choices).toEqual(castIds);
    expect([...allowed].sort()).toEqual([...castIds].sort());
    await expect(page.locator(".coach-group-label")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Coach collections" })).toHaveCount(0);
    await expect(page.locator(".coach-settings").getByRole("tab")).toHaveCount(0);
    for (const name of retainedNames) {
      await expect(page.getByRole("radio", { name, exact: true })).toBeVisible();
    }
    // A spread of round trips (first human after the default, an animal, the last coach);
    // the full cast is checked against the picker and the OpenAPI enum above.
    for (const coachId of ["man-host", "cat-tuxedo", "living-pawn"]) {
      const radio = page.locator(`input[name="coach"][value="${coachId}"]`);
      await expect(radio).toBeVisible();
      await radio.click();
      await expect(radio).toBeChecked();
      await expect(page.getByLabel("Coach motion", { exact: true })).toBeEnabled();
      // The picker shows a new choice at once and saves it in the background.
      await expect
        .poll(async () => (await page.request.get(preferences)).json())
        .toEqual({
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
      await page
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("link", { name: "Coach & animations", exact: true })
        .click();
      await expect(radio).toBeChecked();
    }
    await page.screenshot({
      path: `test-results/coach-selection-${info.project.name}.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  } finally {
    await page.request.put(preferences, {
      data: { coach_id: "classic", motion: "natural" },
    });
  }
});
