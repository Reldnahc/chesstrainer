import { expect, test, type Page } from "./helpers/browserTest";
import type { Job, Schema } from "../src/api";

type Motion = Schema["MotionPreferences"]["motion"];
type LayoutTrace = { starts: number; ends: number; transitions: Animation[] };

async function fixtures(page: Page) {
  const state: { motion: Motion; jobs: Job[] } = { motion: "still", jobs: [] };
  const providers: Schema["GameProvider"][] = [
    {
      id: "chesscom",
      name: "Chess.com",
      time_classes: ["all", "bullet", "blitz", "rapid", "daily"],
    },
    {
      id: "lichess",
      name: "Lichess",
      time_classes: ["all", "bullet", "blitz", "rapid", "classical"],
    },
  ];
  await page.route("**/api/game-providers", route => route.fulfill({ json: providers }));
  await page.route("**/api/providers/*/sync", route =>
    route.fulfill({
      json: {
        provider: new URL(route.request().url()).pathname.split("/")[3],
        username: "",
        job_id: null,
        status: "not_started",
        checked_at: null,
        imported: 0,
        error: null,
      },
    }),
  );
  await page.route("**/api/jobs", route => route.fulfill({ json: state.jobs }));
  await page.route("**/api/preferences/motion", route =>
    route.fulfill({ json: { motion: state.motion } }),
  );
  await page.route("**/api/health", route =>
    route.fulfill({
      json: {
        database: "presentation-fixture",
        engine_available: true,
        engine_error: null,
        engine_status: "ready",
        engine_version: "presentation-fixture",
      },
    }),
  );
  return state;
}

async function watchLayout(page: Page) {
  await page.addInitScript(() => {
    const trace: LayoutTrace = { starts: 0, ends: 0, transitions: [] };
    Object.assign(window, { importLayoutMotion: trace });
    document.addEventListener(
      "transitionrun",
      event => {
        if (
          event.propertyName !== "grid-template-rows" ||
          !(event.target instanceof HTMLElement) ||
          !event.target.matches(".import-form")
        )
          return;
        trace.starts++;
        const transition = event.target
          .getAnimations()
          .find(
            value =>
              value instanceof CSSTransition && value.transitionProperty === event.propertyName,
          )!;
        trace.transitions.push(transition);
        transition.pause();
      },
      true,
    );
    document.addEventListener(
      "transitionend",
      event => {
        if (
          event.propertyName === "grid-template-rows" &&
          event.target instanceof HTMLElement &&
          event.target.matches(".import-form")
        )
          trace.ends++;
      },
      true,
    );
  });
}

const layoutTrace = (page: Page) =>
  page.evaluate(() => {
    const trace = (window as unknown as { importLayoutMotion: LayoutTrace }).importLayoutMotion;
    return {
      starts: trace.starts,
      ends: trace.ends,
      states: trace.transitions.map(value => value.playState),
    };
  });

async function pausedLayout(page: Page, starts: number) {
  await expect.poll(async () => (await layoutTrace(page)).starts).toBe(starts);
  await page.evaluate(async () => {
    await (
      window as unknown as { importLayoutMotion: LayoutTrace }
    ).importLayoutMotion.transitions.at(-1)!.ready;
  });
  expect((await layoutTrace(page)).states.at(-1)).toBe("paused");
}

async function finishLayout(page: Page) {
  const ends = await page.evaluate(() => {
    const trace = (window as unknown as { importLayoutMotion: LayoutTrace }).importLayoutMotion;
    trace.transitions.at(-1)!.finish();
    return trace.ends;
  });
  await expect.poll(async () => (await layoutTrace(page)).ends).toBe(ends + 1);
}

const layout = (page: Page) =>
  page.evaluate(() => ({
    height: document.querySelector(".import-form")!.getBoundingClientRect().height,
    activity: document.querySelector("#settings-activity")!.getBoundingClientRect().top + scrollY,
  }));

async function expectClosed(page: Page) {
  const wrapper = page.locator(".import-form");
  await expect(wrapper).toHaveCount(1);
  await expect(wrapper.locator(".import-form-body")).toHaveCount(0);
  await expect(wrapper).toHaveAttribute("aria-hidden", "true");
  await expect(wrapper).toHaveAttribute("inert", "");
  await expect(wrapper).not.toHaveAttribute("tabindex");
  await expect(wrapper).not.toHaveAttribute("data-open");
  expect((await layout(page)).height).toBeCloseTo(0, 0);
}

async function openImport(page: Page, source: "chesscom" | "pgn") {
  if (source === "pgn") await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  else
    await page
      .getByRole("region", { name: "Recent Chess.com games", exact: true })
      .getByRole("button", { name: "Import older games", exact: true })
      .click();
  const form = page.getByRole("form", {
    name: source === "pgn" ? "Import PGN" : "Import from Chess.com",
    exact: true,
  });
  await expect(form).toBeVisible();
  return form;
}

test("editing, polling and switching an open source preserve the shell without replaying expansion", async ({
  page,
}) => {
  const state = await fixtures(page);
  state.motion = "natural";
  await watchLayout(page);
  const job = (games: number): Job => ({
    id: "import-presentation-history",
    status: "completed",
    kind: "analysis",
    user_id: "presentation-fixture",
    created_at: "2026-09-29T10:00:00Z",
    activity: null,
    cancel_requested: false,
    classifications_completed: games,
    priority: 0,
    puzzles_found: 0,
    deep_completed: games,
    error: null,
    games_processed: games,
    games_total: games,
    import_id: null,
    mistakes_identified: games,
    positions_triaged: games * 2,
    probe_total: null,
    provider_import: null,
  });
  for (const source of ["chesscom", "pgn"] as const) {
    state.jobs = [job(1)];
    await page.goto("/settings");
    await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "natural");
    const wrapper = await page.locator(".import-form").elementHandle();
    const form = await openImport(page, source);
    await pausedLayout(page, 1);
    await finishLayout(page);
    const original = await form.elementHandle();
    if (source === "pgn")
      await form.getByRole("button", { name: "Paste PGN text", exact: true }).click();
    const draft =
      source === "pgn"
        ? form.getByRole("textbox", { name: "PGN", exact: true })
        : form.getByLabel("Chess.com username", { exact: true });
    await expect(draft).toBeEnabled();
    const value = source === "pgn" ? '[White "Draft"]\n\n1. d4 d5 *' : "Unfinished_Draft";
    await draft.fill(value);
    await draft.focus();
    state.jobs = [job(2)];
    await expect(page.locator(".job-history summary")).toContainText("2 / 2 games · 4 decisions");
    expect(
      await original!.evaluate(element => element === document.querySelector(".import-form form")),
    ).toBe(true);
    await expect(draft).toHaveValue(value);
    await expect(draft).toBeFocused();
    expect(await layoutTrace(page)).toMatchObject({ starts: 1, ends: 1 });
    const other = source === "pgn" ? "chesscom" : "pgn";
    await openImport(page, other);
    // Flush the new source's style and transition events without a timed sleep.
    await page.evaluate(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
    expect(
      await wrapper!.evaluate(element => element === document.querySelector(".import-form")),
    ).toBe(true);
    expect(await original!.evaluate(element => element.isConnected)).toBe(false);
    expect(await layoutTrace(page)).toMatchObject({ starts: 1, ends: 1 });
    await page.getByRole("button", { name: "Close import form", exact: true }).click();
    await pausedLayout(page, 2);
    await finishLayout(page);
    await expectClosed(page);
    await openImport(page, other);
    await pausedLayout(page, 3);
    await finishLayout(page);
    expect(
      await wrapper!.evaluate(element => element === document.querySelector(".import-form")),
    ).toBe(true);
  }
});
