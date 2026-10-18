import { expect, test, type Locator, type Page } from "./helpers/browserTest";

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

// The player's Next puzzle entry differs only in which button starts the same flow.
test("retrying lost puzzle creation from library keeps its selected puzzle and allows a later new puzzle", async ({
  page,
}, info) => {
  const fixtureResponse = await page.request.post(
    `/__test/puzzle-fixture/start-retry-library-${info.project.name}`,
  );
  expect(fixtureResponse.ok()).toBe(true);
  let selections = 0;
  await page.route("**/api/puzzles/next**", route => {
    selections++;
    return route.continue();
  });
  const attempts = await loseFirstStart(page, "/api/puzzle-sessions");
  await page.goto("/study/puzzles");
  await retryStart(
    page,
    page.getByRole("button", { name: "Start a puzzle", exact: true }),
    attempts,
  );
  expect(selections).toBe(1);
  expect(
    (
      await page.request.post(`/api/puzzle-sessions/${attempts[0].sessionId}/reveal`, {
        data: {
          request_id: `finish-retry-library-${info.project.name}`,
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
