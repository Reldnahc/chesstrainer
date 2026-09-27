import { test, expect } from "@playwright/test";

test("every registered coach can be chosen and restored in a real game", async ({
  page,
}, info) => {
  test.setTimeout(90000);
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
  const choices: string[] = [];
  try {
    await page.goto("/settings");
    for (const group of ["Men", "Women", "Cats", "Dogs"]) {
      await page.getByRole("button", { name: group, exact: true }).click();
      const radios = page.getByRole("radio");
      const ids = await radios.evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
      choices.push(...ids);
      for (const coachId of ids) {
        const radio = page.locator(`input[name="coach"][value="${coachId}"]`);
        await radio.click();
        await expect(radio).toBeChecked();
        await expect(
          page.getByLabel("Coach motion", { exact: true }),
        ).toBeEnabled();
        expect(await (await page.request.get(preferences)).json()).toEqual({
          coach_id: coachId,
          motion: "still",
        });
        await page.goto(`/games/${id}?ply=3`);
        const avatar = page.locator(".review-coach .coach-avatar");
        await expect(avatar).toHaveAttribute("data-coach", coachId);
        await expect(avatar).toHaveAttribute("data-expression", "blunder", {
          timeout: 30000,
        });
        await expect(avatar.locator("svg")).toBeVisible();
        await page.getByRole("link", { name: "Settings", exact: true }).click();
        await expect(
          page.getByRole("button", { name: group, exact: true }),
        ).toHaveAttribute("aria-pressed", "true");
        await expect(radio).toBeChecked();
      }
    }
    // Catch missing API choices, duplicate registrations and accidental preview-only entries.
    expect(choices.sort()).toEqual([...allowed].sort());
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
