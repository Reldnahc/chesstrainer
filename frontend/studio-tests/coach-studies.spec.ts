import { expect, test, type Page } from "../tests/helpers/browserTest";

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

type Character = (typeof characters)[number];

// Each collection is its own page that shares the closing checks below.
async function openStudies(page: Page, character: Character) {
  const errors: string[] = [];
  const apiRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", request => {
    if (request.url().includes("/api/")) apiRequests.push(request.url());
  });
  // Drive the dwell and settle timers explicitly: on a loaded CI worker a
  // wall-clock reaction can finish before its assertion reaches the browser.
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/?coach=${character.id}&expression=brilliant`);
  const concepts = page.locator(".studio-concepts .coach-avatar");
  await expect(concepts).toHaveCount(character.families.length);
  for (const avatar of await concepts.all())
    await expect(avatar).toHaveAttribute("data-coach", character.id);
  await expect(page.getByText("Available in Settings", { exact: true })).toHaveCount(
    character.families.length,
  );
  return { concepts, errors, apiRequests };
}

async function closeStudies(
  page: Page,
  { concepts, errors, apiRequests }: Awaited<ReturnType<typeof openStudies>>,
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.getByRole("checkbox", { name: "Reduced motion" })).toBeChecked();
  await expect(concepts.first()).toHaveAttribute("data-motion", "still");
  expect(
    await page
      .locator(".coach-avatar")
      .evaluateAll(els => els.flatMap(el => el.getAnimations({ subtree: true })).length),
  ).toBe(0);
  // Each eye mask must belong to its own character across all preview SVGs.
  const ids = await page.locator(".coach-avatar clipPath").evaluateAll(els => els.map(el => el.id));
  expect(new Set(ids).size).toBe(ids.length);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  expect(apiRequests).toEqual([]);
}

// One collection per character, on desktop only: each rig family shares its reaction
// machinery, and Men use a non-storyteller collection so the classic CSS leak check runs.
const collections: Record<string, string> = {
  classic: "host",
  woman: "captain",
  cat: "tuxedo",
  dog: "gentle",
};

for (const character of characters) {
  const family = collections[character.id];
  test(`${character.name} ${family} collection performs both signature reactions at review sizes`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "One viewport covers the shared reaction rigs.");
    const studies = await openStudies(page, character);
    await page.getByRole("combobox", { name: "Collection", exact: true }).selectOption(family);
    await expect(
      page.locator(`.studio-expression .coach-avatar[data-family="${family}"]`),
    ).toHaveCount(20);
    await page.locator(".studio-collection").screenshot({
      path: `studio-test-results/studies-${character.id}-${family}-${info.project.name}.png`,
    });
    // Every rig must actually perform both signature reactions. The original
    // man's CSS must not leak onto the shared human rig of the other men.
    const portrait = page.locator(`.studio-${family} .coach-avatar`);
    for (const state of ["brilliant", "blunder"]) {
      await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption(state);
      // Commit the selected expression first, so its pending dwell cannot
      // satisfy the separate replay's new-take assertion below.
      await page.clock.runFor(110);
      const take = Number(await portrait.getAttribute("data-take"));
      await page.getByRole("button", { name: "Replay reaction", exact: true }).click();
      // Replay must reveal the selected portrait, including collections
      // farther down the stacked mobile layout, before the dwell completes.
      await expect(portrait).toBeInViewport();
      await page.clock.runFor(110);
      await expect(portrait).toHaveAttribute("data-take", String(take + 1));
      await expect(portrait).toHaveAttribute("data-phase", "reaction");
      await expect(portrait).toHaveAttribute("data-expression", state);
      await expect
        .poll(() =>
          portrait.evaluate(
            el =>
              el
                .getAnimations({ subtree: true })
                .filter(animation => animation.playState === "running").length,
          ),
        )
        .toBeGreaterThan(0);
      if (character.id === "classic" && family !== "storyteller") {
        expect(
          await portrait.evaluate(el =>
            el
              .getAnimations({ subtree: true })
              .some(
                animation =>
                  animation instanceof CSSAnimation &&
                  animation.animationName.startsWith("classic-"),
              ),
          ),
        ).toBe(false);
      }
      await page.clock.runFor(2000);
      await expect(portrait).toHaveAttribute("data-phase", "rest");
    }

    await closeStudies(page, studies);
  });
}
