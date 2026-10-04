import { expect, type Page } from "@playwright/test";

type DueReview = { exercise_id: string; new: boolean };

/**
 * Snapshot the review queue once this worker's server is idle. Earlier files'
 * imports and reviews keep running in the background and can make work due.
 */
export async function settledDueReviews(page: Page): Promise<DueReview[]> {
  // Game reviews count too: a review also trains on its game and can add a due card.
  await expect.poll(async () => {
    const jobs = await (await page.request.post("/__test/active-jobs")).json() as { active: number };
    return jobs.active;
  }, { timeout: 60_000 }).toBe(0);
  return (await page.request.get("/api/review/queue")).json();
}

/**
 * The test added and consumed no review work. Exercises reviewed by earlier files
 * on the same server still come due on their own learning steps while it runs,
 * so only those may join the queue.
 */
export async function expectNoNewDueReviews(page: Page, before: DueReview[]) {
  const after: DueReview[] = await (await page.request.get("/api/review/queue")).json();
  const ids = new Set(after.map(item => item.exercise_id));
  expect(before.filter(item => !ids.has(item.exercise_id))).toEqual([]);
  const earlier = new Set(before.map(item => item.exercise_id));
  expect(after.filter(item => !earlier.has(item.exercise_id) && item.new)).toEqual([]);
}
