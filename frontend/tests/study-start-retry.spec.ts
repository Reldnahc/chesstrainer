import { expect, test, type Locator, type Page } from "./helpers/browserTest";
import type { Schema } from "../src/api";
import { retryableStart } from "../src/study/retryableStart";

for (const outcome of ["empty", "failure"] as const) {
  test(`a changed target cannot revive an older pending command after ${outcome} preparation`, async () => {
    let loseResponse = true;
    const submitted: { target: string; request_id: string }[] = [];
    const start = retryableStart(
      async (target: string) => {
        if (target === "other") {
          if (outcome === "failure") throw new Error("Selection unavailable");
          return null;
        }
        return { target };
      },
      async body => {
        submitted.push(body);
        if (loseResponse) {
          loseResponse = false;
          throw new Error("Lost response");
        }
        return body;
      },
    );
    await expect(start("chapter")).rejects.toThrow("Lost response");
    if (outcome === "failure")
      await expect(start("other")).rejects.toThrow("Selection unavailable");
    else await expect(start("other")).resolves.toBeNull();
    const fresh = await start("chapter");
    expect(submitted).toHaveLength(2);
    expect(fresh?.request_id).not.toBe(submitted[0].request_id);
  });
}

type Attempt = { body: Record<string, unknown>; sessionId: string };

async function loseFirstStart(page: Page, path: string) {
  const attempts: Attempt[] = [];
  await page.route(`**${path}`, async route => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    const session: { id: string } = await response.json();
    attempts.push({ body: route.request().postDataJSON(), sessionId: session.id });
    // The server has committed. Only the browser's response is lost.
    if (attempts.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  return attempts;
}

async function retryStart(page: Page, button: Locator, attempts: Attempt[]) {
  await button.click();
  await expect(page.getByRole("alert")).toContainText("can't be reached");
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page).toHaveURL(new RegExp(`/sessions/${attempts[0].sessionId}$`));
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
}

async function lessonFixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/lesson-fixture/${key}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ course_id: string; revision: string }>;
}

test("retrying a lost chapter start resumes its committed session, while a later start is new", async ({
  page,
}, info) => {
  const fixture = await lessonFixture(page, `start-retry-${info.project.name}`);
  const path = `/study/openings/courses/${fixture.course_id}?revision=${fixture.revision}`;
  await page.goto(path);
  const attempts = await loseFirstStart(page, "/api/study/lesson-sessions");
  await retryStart(page, page.getByRole("button", { name: "Start", exact: true }), attempts);
  await expect(
    page.getByRole("heading", { name: "Start from the beginning", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Chapters", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect.poll(() => attempts.length).toBe(3);
  await expect(page).toHaveURL(new RegExp(`/sessions/${attempts[2].sessionId}$`));
  expect(attempts[2].sessionId).not.toBe(attempts[0].sessionId);
  expect(attempts[2].body.request_id).not.toBe(attempts[0].body.request_id);
});

for (const entry of ["preview", "studies"] as const) {
  test(`retrying lost practice creation from ${entry} reuses the committed session`, async ({
    page,
  }, info) => {
    const fixture = await lessonFixture(page, `practice-retry-${entry}-${info.project.name}`);
    const response = await page.request.get(
      `/api/openings/course-lines/${fixture.course_id}/fixture-main?revision=${fixture.revision}`,
    );
    expect(response.ok()).toBe(true);
    const { line }: Schema["OpeningLineView"] = await response.json();
    const enrolled = await page.request.post("/api/opening-studies", {
      data: {
        source: line.source,
        source_key: line.source_key,
        source_version: line.source_version,
        course_id: line.course_id,
        line_id: line.line_id,
        color: "white",
      },
    });
    expect(enrolled.ok()).toBe(true);
    const study: Schema["OpeningStudyView"] = await enrolled.json();
    try {
      await page.goto(
        entry === "preview"
          ? `/study/openings/courses/${fixture.course_id}/lines/fixture-main?revision=${fixture.revision}`
          : "/study/openings/studies",
      );
      const attempts = await loseFirstStart(page, `/api/opening-studies/${study.id}/practice`);
      const button =
        entry === "preview"
          ? page.getByRole("button", { name: "Practice line", exact: true })
          : page
              .getByRole("article", { name: `${study.name} as white`, exact: true })
              .filter({ has: page.getByRole("button", { name: "Pause recalls", exact: true }) })
              .getByRole("button", { name: "Practice line", exact: true });
      await retryStart(page, button, attempts);
      await expect(
        page.getByRole("region", { name: "Lesson position", exact: true }),
      ).toBeVisible();
    } finally {
      expect((await page.request.delete(`/api/opening-studies/${study.id}`)).ok()).toBe(true);
    }
  });
}

for (const entry of ["library", "player"] as const) {
  test(`retrying lost puzzle creation from ${entry} keeps its selected puzzle and allows a later new puzzle`, async ({
    page,
  }, info) => {
    const fixtureResponse = await page.request.post(
      `/__test/puzzle-fixture/start-retry-${entry}-${info.project.name}`,
    );
    expect(fixtureResponse.ok()).toBe(true);
    const fixture: { session_id: string } = await fixtureResponse.json();
    if (entry === "player") {
      expect(
        (
          await page.request.post(`/api/puzzle-sessions/${fixture.session_id}/reveal`, {
            data: {
              request_id: `reveal-${entry}-${info.project.name}`,
              revision: 0,
            },
          })
        ).ok(),
      ).toBe(true);
    }
    let selections = 0;
    await page.route("**/api/puzzles/next**", route => {
      selections++;
      return route.continue();
    });
    const attempts = await loseFirstStart(page, "/api/puzzle-sessions");
    await page.goto(
      entry === "library" ? "/study/puzzles" : `/study/puzzles/sessions/${fixture.session_id}`,
    );
    await retryStart(
      page,
      page.getByRole("button", {
        name: entry === "library" ? "Start a puzzle" : "Next puzzle",
        exact: true,
      }),
      attempts,
    );
    expect(selections).toBe(1);
    expect(
      (
        await page.request.post(`/api/puzzle-sessions/${attempts[0].sessionId}/reveal`, {
          data: {
            request_id: `finish-retry-${entry}-${info.project.name}`,
            revision: 0,
          },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Next puzzle", exact: true }).click();
    await expect.poll(() => attempts.length).toBe(3);
    await expect(page).toHaveURL(new RegExp(`/sessions/${attempts[2].sessionId}$`));
    expect(selections).toBe(2);
    expect(attempts[2].sessionId).not.toBe(attempts[0].sessionId);
    expect(attempts[2].body.request_id).not.toBe(attempts[0].body.request_id);
  });
}

test("practising a study and pausing it share one guard, so two clicks in one frame start only one", async ({
  page,
}) => {
  const study = {
    id: "guard-study",
    name: "Guard line",
    color: "white",
    active: true,
    eco: "C50",
    positions: 4,
    due_positions: 1,
    source: "lichess_catalogue",
    source_key: "guard",
    source_version: "v1",
    course_id: null,
    line_id: null,
  } as unknown as Schema["OpeningStudySummary"];
  await page.route("**/api/opening-studies", route =>
    route.fulfill({
      json: {
        items: [study],
        active_studies: 1,
        learning_positions: 4,
        due_positions: 1,
      } satisfies Schema["OpeningStudyLibrary"],
    }),
  );
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  const calls: string[] = [];
  await page.route("**/api/opening-studies/guard-study/**", async route => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await held;
    await route.fulfill({ status: 503, json: { detail: "Practice is unavailable." } });
  });
  await page.route("**/api/opening-studies/guard-study", route => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    return route.fulfill({ status: 503, json: { detail: "Pause is unavailable." } });
  });
  await page.goto("/study/openings/studies");
  const row = page.getByRole("article", { name: "Guard line as white" });
  await expect(row.getByRole("button", { name: "Pause recalls" })).toBeEnabled();
  // Both clicks land before React re-renders the disabled buttons.
  await row.evaluate(element => {
    const buttons = [...element.querySelectorAll("button")];
    buttons.find(button => button.textContent?.includes("Practice line"))!.click();
    buttons.find(button => button.textContent?.includes("Pause recalls"))!.click();
  });
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toBe("POST /api/opening-studies/guard-study/practice");
  await expect(row.getByRole("button", { name: "Opening…" })).toBeDisabled();
  release();
  await expect(page.getByRole("alert")).toContainText("Practice is unavailable.");
  expect(calls).toHaveLength(1);
});
