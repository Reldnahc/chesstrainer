import { expect, test, type Page } from "./helpers/browserTest";
import type { Schema } from "../src/api";

async function lessonFixture(page: Page, key: string) {
  const response = await page.request.post(`/__test/lesson-fixture/${key}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ course_id: string; revision: string }>;
}

test("lesson sources retain multiple citations and licenses but only link valid HTTP sources", async ({
  page,
}, info) => {
  const fixture = await lessonFixture(page, `source-citations-${info.project.name}`);
  const path = `/api/study/courses/${encodeURIComponent(fixture.course_id)}`;
  const response = await page.request.get(
    `${path}?revision=${encodeURIComponent(fixture.revision)}`,
  );
  expect(response.ok()).toBe(true);
  const course: Schema["LessonCourseView"] = await response.json();
  course.attributions = [
    {
      text: "Historical game collection",
      license: "Public domain",
      url: "https://example.test/chess/game",
    },
    { text: "Original lesson commentary", license: null, url: "http://example.test/commentary" },
    { text: "Printed reference", license: "CC BY 4.0", url: null },
    ...[
      "javascript:alert(1)",
      "data:text/html,unsafe",
      "//example.test/source",
      "/relative-source",
      "https://",
    ].map((url, index) => ({
      text: `Unlinked reference ${index + 1}`,
      license: null,
      url,
    })),
  ];
  await page.route(`**${path}?*`, route => route.fulfill({ json: course }));
  await page.goto(
    `/study/openings/courses/${encodeURIComponent(fixture.course_id)}?revision=${encodeURIComponent(fixture.revision)}`,
  );
  const sources = page.locator(".lesson-attributions");
  await expect(sources.getByRole("heading", { name: "Sources", exact: true })).toBeVisible();
  const lines = sources.locator(".source-line");
  await expect(lines).toHaveCount(8);
  await expect(lines.nth(0)).toHaveText("Historical game collection · Public domain · View source");
  await expect(lines.nth(1)).toHaveText("Original lesson commentary · View source");
  await expect(lines.nth(2)).toHaveText("Printed reference · CC BY 4.0");
  const links = sources.getByRole("link", { name: "View source", exact: true });
  await expect(links).toHaveCount(2);
  await expect(links.nth(0)).toHaveAttribute("href", "https://example.test/chess/game");
  await expect(links.nth(1)).toHaveAttribute("href", "http://example.test/commentary");
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }
  for (let index = 3; index < 8; index++) {
    await expect(lines.nth(index)).toHaveText(`Unlinked reference ${index - 2}`);
    await expect(lines.nth(index).getByRole("link")).toHaveCount(0);
  }
  course.attributions = [];
  await page.reload();
  await expect(page.getByRole("heading", { name: course.title, exact: true })).toBeVisible();
  await expect(sources).toHaveCount(0);

  await page.goto("/study/openings/courses/italian-foundations?revision=2026-10-v5");
  const license = sources.getByRole("link", { name: "Repository license", exact: true });
  await expect(license).toHaveAttribute(
    "href",
    "https://github.com/Reldnahc/chesstrainer/blob/main/LICENSE",
  );
  await expect(license).toHaveAttribute("target", "_blank");
  await expect(license).toHaveAttribute("rel", "noopener noreferrer");
});
