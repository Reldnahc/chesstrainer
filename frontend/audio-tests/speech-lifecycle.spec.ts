import { openAudioFixturePage } from "./fixtures/openAudioFixture";
import { expect, test, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import type { SpeechActivity, SpeechPlayback } from "../src/audio/model";
import type { CoachMotion } from "../src/coach/model";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";

type Options = { coach: string; feedId: string | null; motion: CoachMotion };
type FeedOptions = { id: string; coachId: string; energy: number };
type SpeechHarness = {
  update: (patch: Partial<Options>) => void;
  addFeed: (feed: FeedOptions) => void;
  reads: () => Record<string, number>;
  unmount: () => void;
  detached: () => { connected: boolean; speaking: string | undefined; styles: string[] };
};
type HarnessWindow = Window & { speechHarness: SpeechHarness };

async function mountSpeech(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openAudioFixturePage(page);
  await page.evaluate(
    async ({ root }) => {
      // Exercise the real shared portrait with controllable handles. This harness
      // exists only in the browser test; production exposes no testing entrypoint.
      const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
      const { CoachCharacter } = await import(`${root}/src/coach/CoachCharacter.tsx`);
      const { getCoach } = await import(`${root}/src/coach/registry.ts`);
      let current: Options = { coach: "classic", feedId: "first", motion: "natural" };
      const counts: Record<string, number> = {};
      const feeds = new Map<string, SpeechPlayback>();
      const values = new Map<string, SpeechActivity>();
      const addFeed = ({ id, coachId, energy }: FeedOptions) => {
        counts[id] = 0;
        values.set(id, { elapsedSeconds: 0.3, energy, brightness: 0.35 });
        feeds.set(id, {
          scope: "speech-lifecycle",
          eventId: id,
          utteranceId: id,
          coachId,
          read: () => {
            counts[id]++;
            return values.get(id)!;
          },
        });
      };
      addFeed({ id: "first", coachId: "classic", energy: 0.9 });
      const container = document.createElement("div");
      container.id = "speech-lifecycle-harness";
      container.style.cssText =
        "position:fixed;inset:12px auto auto 12px;width:150px;height:190px;z-index:9999";
      document.body.append(container);
      const mounted = createRoot(container);
      let detached: HTMLElement | null = null;
      const render = () =>
        mounted.render(
          React.createElement(CoachCharacter, {
            coach: getCoach(current.coach),
            reaction: { state: "neutral", key: "lifecycle" },
            motion: current.motion,
            idle: false,
            speech: current.feedId ? feeds.get(current.feedId) : undefined,
          }),
        );
      (window as unknown as HarnessWindow).speechHarness = {
        update: patch => {
          current = { ...current, ...patch };
          render();
        },
        addFeed,
        reads: () => ({ ...counts }),
        unmount: () => {
          detached = container.querySelector<HTMLElement>(".coach-avatar");
          mounted.unmount();
          container.remove();
        },
        detached: () => ({
          connected: detached?.isConnected ?? false,
          speaking: detached?.dataset.speaking,
          styles: ["--speech-open", "--speech-round", "--speech-jaw"].map(
            name => detached?.style.getPropertyValue(name) ?? "",
          ),
        }),
      };
      render();
    },
    { root: viteFsPath(path.resolve(".")) },
  );
  const portrait = page.locator("#speech-lifecycle-harness .coach-avatar");
  await expect(portrait).toBeVisible();
  return portrait;
}

const reads = (page: Page) =>
  page.evaluate(() => (window as unknown as HarnessWindow).speechHarness.reads());
const update = (page: Page, patch: Partial<Options>) =>
  page.evaluate(patch => (window as unknown as HarnessWindow).speechHarness.update(patch), patch);

test("switching coaches cleans up the old speaking portrait and stops reading its handle", async ({
  page,
}) => {
  const portrait = await mountSpeech(page);
  await page.clock.runFor(160);
  await expect(portrait).toHaveAttribute("data-speaking", "true");
  expect((await reads(page)).first).toBeGreaterThan(0);
  await update(page, { coach: "dog-collie" });
  await expect(portrait).toHaveAttribute("data-coach", "dog-collie");
  await expect(portrait).toHaveAttribute("data-speaking", "false");
  const stopped = await reads(page);
  await page.clock.runFor(500);
  expect(await reads(page)).toEqual(stopped);
  expect(
    await portrait.evaluate(node =>
      ["--speech-open", "--speech-round", "--speech-jaw"].map(name =>
        (node as HTMLElement).style.getPropertyValue(name),
      ),
    ),
  ).toEqual(["", "", ""]);
});

test("a replacement handle owns subsequent frames and unmount cancels its animation loop", async ({
  page,
}) => {
  const portrait = await mountSpeech(page);
  await page.clock.runFor(160);
  await expect(portrait).toHaveAttribute("data-speaking", "true");
  await page.evaluate(() =>
    (window as unknown as HarnessWindow).speechHarness.addFeed({
      id: "replacement",
      coachId: "classic",
      energy: 0.2,
    }),
  );
  const replaced = await reads(page);
  await update(page, { feedId: "replacement" });
  // The replacement continues from the current mouth instead of snapping it shut.
  await expect(portrait).toHaveAttribute("data-speaking", "true");
  await page.clock.runFor(16);
  const before = await reads(page);
  expect(before.first).toBe(replaced.first);
  await page.clock.runFor(160);
  const after = await reads(page);
  expect(after.first).toBe(before.first);
  expect(after.replacement).toBeGreaterThan(0);
  expect(
    await portrait.evaluate(node =>
      Number((node as HTMLElement).style.getPropertyValue("--speech-open")),
    ),
  ).toBeCloseTo(0.2, 1);
  await page.evaluate(() => (window as unknown as HarnessWindow).speechHarness.unmount());
  await expect(portrait).toHaveCount(0);
  const unmounted = await reads(page);
  await page.clock.runFor(500);
  expect(await reads(page)).toEqual(unmounted);
  expect(
    await page.evaluate(() => (window as unknown as HarnessWindow).speechHarness.detached()),
  ).toEqual({ connected: false, speaking: "false", styles: ["", "", ""] });
});
