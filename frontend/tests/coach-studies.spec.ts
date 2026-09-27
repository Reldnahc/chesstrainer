import { expect, test } from "@playwright/test";
import { expressions } from "../src/coach/model";

const characters = [
  {
    id: "woman",
    name: "Woman",
    families: ["captain", "analyst", "spark"],
    micro: "hair",
  },
  {
    id: "cat",
    name: "Cat",
    families: ["tabby", "tuxedo", "calico"],
    micro: "ears",
  },
  {
    id: "retriever",
    name: "Golden retriever",
    families: ["sunny", "gentle", "scout"],
    micro: "tail",
  },
];

for (const character of characters) {
  test(`${character.name} has three complete expressive studies at review sizes`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.url().includes("/api/"))
        writes.push(request.url());
    });
    await page.goto(`/coach-studio?coach=${character.id}&expression=brilliant`);
    const concepts = page.locator(".studio-concepts .coach-avatar");
    const first = concepts.first();
    await expect(concepts).toHaveCount(3);
    for (const avatar of await concepts.all())
      await expect(avatar).toHaveAttribute("data-coach", character.id);
    await expect(
      page.getByText("In your reviews", { exact: true }),
    ).toHaveCount(0);
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute("data-phase", "reaction");
    await expect
      .poll(() =>
        first.evaluate((el) => el.getAnimations({ subtree: true }).length),
      )
      .toBeGreaterThan(0);
    await expect(first).toHaveAttribute("data-phase", "rest");
    await page.locator(".studio-concepts").screenshot({
      path: `test-results/studies-${character.id}-brilliant-${info.project.name}.png`,
    });

    const geometry = () =>
      page.locator(".studio-concepts").evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      }));
    const before = await geometry();
    for (const expression of expressions) {
      await page
        .getByRole("combobox", { name: "Expression", exact: true })
        .selectOption(expression);
      for (const avatar of await concepts.all())
        await expect(avatar).toHaveAttribute("data-expression", expression);
      expect(await geometry()).toEqual(before);
    }
    await page
      .getByRole("combobox", { name: "Expression", exact: true })
      .selectOption("blunder");
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute("data-phase", "reaction");
    await expect(first).toHaveAttribute("data-phase", "rest");
    await page.locator(".studio-concepts").screenshot({
      path: `test-results/studies-${character.id}-blunder-${info.project.name}.png`,
    });

    for (const family of character.families) {
      await page
        .getByRole("combobox", { name: "Collection", exact: true })
        .selectOption(family);
      await expect(
        page.locator(
          `.studio-expression .coach-avatar[data-family="${family}"]`,
        ),
      ).toHaveCount(20);
      await expect(
        page.locator(".studio-context-compact .coach-avatar"),
      ).toHaveCSS("width", "52.5px");
      if (info.project.name === "desktop") {
        const roomy = page.locator(
          ".studio-context:not(.studio-context-compact) .coach-avatar",
        );
        // Layout uses subpixel units; 92.8 CSS pixels rounds to 92.796875.
        expect(
          await roomy.evaluate((el) => el.getBoundingClientRect().width),
        ).toBeCloseTo(92.8, 1);
      }
      await page.locator(".studio-collection").screenshot({
        path: `test-results/studies-${character.id}-${family}-${info.project.name}.png`,
      });
    }

    const idles = page.getByRole("combobox", {
      name: "Idle gesture",
      exact: true,
    });
    await idles.selectOption(character.micro);
    await page
      .getByRole("button", { name: "Preview idle", exact: true })
      .click();
    const chosen = concepts.last();
    await chosen.scrollIntoViewIfNeeded();
    await expect(chosen).toHaveAttribute("data-micro", character.micro);
    await expect
      .poll(() =>
        chosen.evaluate((el) => el.getAnimations({ subtree: true }).length),
      )
      .toBeGreaterThan(0);
    await expect(chosen).toHaveAttribute("data-micro", "");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.getByRole("checkbox", { name: "Reduced motion" }),
    ).toBeChecked();
    await expect(first).toHaveAttribute("data-motion", "still");
    expect(
      await page
        .locator(".coach-avatar")
        .evaluateAll(
          (els) =>
            els.flatMap((el) => el.getAnimations({ subtree: true })).length,
        ),
    ).toBe(0);
    // Eye masks must belong to their own character when 29 SVGs share a page.
    const ids = await page
      .locator(".coach-avatar clipPath")
      .evaluateAll((els) => els.map((el) => el.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}

test("study links restore character and family; changing character resets unsupported idles and sequences", async ({
  page,
}) => {
  await page.goto("/coach-studio?coach=cat&family=tuxedo&expression=thinking");
  await expect(
    page.getByRole("button", { name: "Preview Cat", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("tuxedo");
  await page
    .getByRole("combobox", { name: "Idle gesture", exact: true })
    .selectOption("ears");
  await page
    .getByRole("button", { name: "Play a sequence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop sequence" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview Woman", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Stop sequence" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("captain");
  await expect(
    page.getByRole("combobox", { name: "Idle gesture", exact: true }),
  ).toHaveValue("blink");
  await expect(
    page
      .getByRole("combobox", { name: "Idle gesture", exact: true })
      .locator('option[value="ears"]'),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Collection", exact: true })
    .selectOption("analyst");
  await page
    .getByRole("combobox", { name: "Expression", exact: true })
    .selectOption("blunder");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("analyst");
  await expect(
    page.getByRole("combobox", { name: "Expression", exact: true }),
  ).toHaveValue("blunder");
  await expect(
    page.getByRole("button", { name: "Preview Woman", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto(
    "/coach-studio?coach=removed&family=unknown&expression=unknown",
  );
  await expect(
    page.locator(".studio-concepts .coach-avatar").first(),
  ).toHaveAttribute("data-coach", "classic");
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("storyteller");
  await expect(
    page.getByRole("combobox", { name: "Expression", exact: true }),
  ).toHaveValue("brilliant");
  await page.getByRole("link", { name: "Back to Settings" }).click();
  await expect(page.getByRole("radio")).toHaveCount(1);
});
