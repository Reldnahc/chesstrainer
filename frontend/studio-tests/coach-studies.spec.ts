import { expect, test } from "@playwright/test";
import { expressions } from "../src/coach/model";

const characters = [
  {
    id: "classic",
    name: "Men",
    families: ["storyteller", "host", "expert", "partner"],
  },
  {
    id: "woman",
    name: "Women",
    families: ["captain", "analyst", "spark", "blonde"],
  },
  {
    id: "cat",
    name: "Cats",
    families: ["tuxedo", "black"],
  },
  {
    id: "dog",
    name: "Dogs",
    families: ["gentle", "corgi", "collie"],
  },
];

for (const character of characters) {
  test(`${character.name} has complete retained expressive studies at review sizes`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    const apiRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => {
      if (request.url().includes("/api/")) apiRequests.push(request.url());
    });
    await page.goto(`/?coach=${character.id}&expression=brilliant`);
    const concepts = page.locator(".studio-concepts .coach-avatar");
    const first = concepts.first();
    await expect(concepts).toHaveCount(character.families.length);
    for (const avatar of await concepts.all())
      await expect(avatar).toHaveAttribute("data-coach", character.id);
    await expect(
      page.getByText("Available in Settings", { exact: true }),
    ).toHaveCount(character.families.length);
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute("data-phase", "reaction");
    await expect
      .poll(() =>
        first.evaluate((el) => el.getAnimations({ subtree: true }).length),
      )
      .toBeGreaterThan(0);
    await expect(first).toHaveAttribute("data-phase", "rest");
    await page.locator(".studio-concepts").screenshot({
      path: `studio-test-results/studies-${character.id}-brilliant-${info.project.name}.png`,
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
      path: `studio-test-results/studies-${character.id}-blunder-${info.project.name}.png`,
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
        path: `studio-test-results/studies-${character.id}-${family}-${info.project.name}.png`,
      });
      // Every rig must actually perform both signature reactions. The original
      // man's CSS must not leak onto the shared human rig of the other men.
      const portrait = page.locator(`.studio-${family} .coach-avatar`);
      for (const state of ["brilliant", "blunder"]) {
        await page
          .getByRole("combobox", { name: "Expression", exact: true })
          .selectOption(state);
        await page
          .getByRole("button", { name: "Replay reaction", exact: true })
          .click();
        await expect(portrait).toHaveAttribute("data-phase", "reaction");
        await expect(portrait).toHaveAttribute("data-expression", state);
        await expect
          .poll(() =>
            portrait.evaluate(
              (el) =>
                el
                  .getAnimations({ subtree: true })
                  .filter((animation) => animation.playState === "running")
                  .length,
            ),
          )
          .toBeGreaterThan(0);
        if (character.id === "classic" && family !== "storyteller") {
          expect(
            await portrait.evaluate((el) =>
              el
                .getAnimations({ subtree: true })
                .some(
                  (animation) =>
                    animation instanceof CSSAnimation &&
                    animation.animationName.startsWith("classic-"),
                ),
            ),
          ).toBe(false);
        }
      }
    }

    const idles = page.getByRole("combobox", {
      name: "Idle gesture",
      exact: true,
    });
    const idle = await idles.locator("option").first().getAttribute("value");
    await idles.selectOption(idle!);
    await page
      .getByRole("button", { name: "Preview idle", exact: true })
      .click();
    const chosen = concepts.last();
    await chosen.scrollIntoViewIfNeeded();
    await expect(chosen).toHaveAttribute("data-micro", idle!);
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
    // Each eye mask must belong to its own character across all preview SVGs.
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
    expect(apiRequests).toEqual([]);
  });
}

test("study links restore character and family; changing character resets unsupported idles and sequences", async ({
  page,
}) => {
  await page.goto("/?coach=cat&family=tuxedo&expression=thinking");
  await expect(
    page.locator('.studio-cast button:has([data-coach="cat-tuxedo"])'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("tuxedo");
  await page
    .getByRole("combobox", { name: "Idle gesture", exact: true })
    .selectOption({ index: 0 });
  await page
    .getByRole("button", { name: "Play a sequence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop sequence" }),
  ).toBeVisible();
  await page
    .locator('.studio-cast button:has([data-coach="woman-captain"])')
    .click();
  await expect(page.getByRole("button", { name: "Stop sequence" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("captain");
  await expect(
    page.getByRole("combobox", { name: "Idle gesture", exact: true }),
  ).toHaveValue(/.+/);
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
    page.locator('.studio-cast button:has([data-coach="woman-analyst"])'),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto(
    "/?coach=removed&family=unknown&expression=unknown",
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
});

test("retired concepts have safe bookmark fallbacks in the standalone studio", async ({
  page,
}) => {
  for (const family of ["mentor", "spark"]) {
    await page.goto(
      `/?coach=classic&family=${family}&expression=blunder`,
    );
    await expect(
      page.getByRole("combobox", { name: "Collection", exact: true }),
    ).toHaveValue("storyteller");
    await expect(page.locator(".studio-current")).toHaveCount(4);
    await expect(
      page.locator(".studio-storyteller .coach-avatar"),
    ).toHaveAttribute("data-expression", "blunder");
  }
  await page.goto(
    "/?coach=retriever&family=gentle&expression=good",
  );
  await expect(
    page.locator('.studio-cast button:has([data-coach="dog-gentle"])'),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("gentle");
  await expect(page).toHaveURL(/coach=dog-gentle/);
  await page.goto("/?coach=retriever&family=scout");
  await expect(
    page.getByRole("combobox", { name: "Collection", exact: true }),
  ).toHaveValue("gentle");
  for (const bookmark of [
    "coach=cat-tabby", "coach=cat-calico", "coach=cat&family=tabby", "coach=cat&family=calico",
  ]) {
    await page.goto(`/?${bookmark}`);
    await expect(page.locator('.studio-cast button:has([data-coach="cat-kitten"])')).toHaveAttribute("aria-pressed", "true");
  }
  for (const bookmark of ["coach=dog-sunny", "coach=dog&family=sunny", "coach=retriever&family=sunny"]) {
    await page.goto(`/?${bookmark}`);
    await expect(page.locator('.studio-cast button:has([data-coach="dog-puppy"])')).toHaveAttribute("aria-pressed", "true");
  }
});
