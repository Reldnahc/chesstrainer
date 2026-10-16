import { expect, test, type Page } from '@playwright/test';

async function openNewCourse(page: Page) {
  await page.goto('/settings/courses/editor');
  await expect(page.getByRole('button', {name: 'Save course'})).toBeVisible();
  await expect(page.getByText('The course loads without problems.')).toBeVisible();
  return page.getByRole('region', {name: 'Selected step'});
}

test('the step with the check\'s problem is marked from its location, not the message text', async ({page}) => {
  const step = await openNewCourse(page);
  await step.getByLabel('Kind').selectOption('decision');
  await step.getByLabel('Learner\'s move').fill('e5');
  await expect(page.getByText(/e5 is not a legal move/)).toBeVisible();
  const steps = page.getByRole('region', {name: 'Steps'});
  await expect(steps.getByRole('img', {name: 'Has a problem'})).toHaveCount(1);
  await expect(steps.getByRole('listitem').first().getByRole('img', {name: 'Has a problem'})).toBeVisible();
  // A problem outside any step marks none.
  await step.getByLabel('Learner\'s move').fill('e4');
  await expect(page.getByText('The course loads without problems.')).toBeVisible();
  await expect(steps.getByRole('img', {name: 'Has a problem'})).toHaveCount(0);
});

test('renaming a step or a line takes effect when the id is committed, and links follow it', async ({page}) => {
  const step = await openNewCourse(page);
  const steps = page.getByRole('region', {name: 'Steps'});
  await steps.getByRole('button', {name: 'Add step after'}).click();
  await steps.getByRole('button', {name: /Introduction/}).click();
  await step.getByLabel('Then go to').selectOption({label: 'New step (step)'});
  await steps.getByRole('button', {name: /New step/}).click();
  const id = step.getByLabel('Step id');
  await id.fill('introduction-two');
  // Leaving the field commits the new id, and the link to the step follows it.
  await steps.getByRole('button', {name: /Introduction/}).click();
  await expect(step.getByLabel('Then go to')).toHaveValue('introduction-two');
  // A line's id renames the rehearsal steps that replay it.
  await page.getByText(/Lines to remember/).click();
  await page.getByRole('button', {name: 'Add line'}).click();
  await steps.getByRole('button', {name: /New step/}).click();
  await step.getByLabel('Kind').selectOption('rehearsal');
  await step.getByLabel('Line to rehearse').selectOption({label: 'New line'});
  const lineId = page.getByLabel('Line id');
  await lineId.fill('main-line');
  await lineId.press('Enter');
  await expect(step.getByLabel('Line to rehearse')).toHaveValue('main-line');
  await expect(page.getByText('The course loads without problems.')).toBeVisible();
});

test('a course-wide problem marks no step, a taken id is refused, and deleting a linked step leaves no dangling link', async ({page}) => {
  const step = await openNewCourse(page);
  const steps = page.getByRole('region', {name: 'Steps'});
  // A problem in a line, not a step, marks no step.
  await page.getByText(/Lines to remember/).click();
  await page.getByRole('button', {name: 'Add line'}).click();
  const moves = page.getByLabel('Moves', {exact: true});
  await moves.fill('e4 e4');
  await expect(page.getByText(/e4 is not a legal move/)).toBeVisible();
  await expect(steps.getByRole('img', {name: 'Has a problem'})).toHaveCount(0);
  await moves.fill('e4');
  await expect(page.getByText('The course loads without problems.')).toBeVisible();
  // A step cannot take another step's id: the rename is refused and links stay put.
  await steps.getByRole('button', {name: 'Add step after'}).click();
  const id = step.getByLabel('Step id');
  await id.fill('introduction');
  await id.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Another step already uses the id introduction.');
  await expect(id).toHaveValue('step');
  await expect(id).toBeFocused();
  // Deleting a step that another links to leaves the link carrying on instead of naming it.
  await steps.getByRole('button', {name: /Introduction/}).click();
  await step.getByLabel('Then go to').selectOption({label: 'New step (step)'});
  await steps.getByRole('button', {name: /New step/}).click();
  await steps.getByRole('button', {name: 'Delete step'}).click();
  await expect(steps.getByRole('listitem')).toHaveCount(1);
  await expect(step.getByLabel('Then go to')).toHaveValue('__following__');
  await expect(page.getByText('The course loads without problems.')).toBeVisible();
});
