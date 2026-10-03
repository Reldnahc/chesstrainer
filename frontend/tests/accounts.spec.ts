import { test, expect, type APIResponse, type Page } from '@playwright/test';
import type { Schema } from '../src/api';
import {audioCues, captureAudio} from './helpers/audio';

async function settingsSection(page: Page, name: 'Coach & animations' | 'Sound' | 'Account') {
  await page.getByRole('navigation', {name: 'Settings sections'}).getByRole('link', {name, exact: true}).click();
}

async function submitSignup(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(result => new URL(result.url()).pathname === '/api/auth/signup' && result.request().method() === 'POST'),
    page.getByRole('button', {name: 'Create account', exact: true}).click(),
  ]);
  expect(response.status(), 'Account signup must succeed before onboarding').toBe(201);
}

test('account signup, engine-free sync, second-device login and private library', async ({page, browser, extraHTTPHeaders}, info) => {
  const username = `friend-${info.project.name}`;
  await page.goto('/');
  await page.getByRole('button', {name: 'New here? Create an account'}).click();
  await page.getByLabel('Username', {exact: true}).fill(username);
  await page.getByLabel('Password', {exact: true}).fill('test-only-password');
  await submitSignup(page);
  await page.getByRole('button', {name: 'Continue', exact: true}).click();
  await page.getByRole('button', {name: 'Finish for now', exact: true}).click();
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await expect(page.getByLabel('Remembered Chess.com username')).toHaveCount(0);
  await page.getByRole('link', {name: 'Update games', exact: true}).click();
  await expect(page).toHaveURL('/settings');
  await page.getByLabel('Remembered Chess.com username').fill(username);
  await page.getByRole('region', {name: 'Recent Chess.com games', exact: true}).getByRole('button', {name: 'Save username', exact: true}).click();
  await expect(page.getByText('Change Chess.com connection', {exact: true})).toBeVisible();
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await expect(page.getByLabel('Remembered Chess.com username')).toHaveCount(0);
  const syncResponse = page.waitForResponse(r => r.url().endsWith('/api/providers/chesscom/sync') && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Update games', exact: true}).click();
  expect((await syncResponse).ok()).toBe(true);
  await expect(page.locator('.game-library-item')).toHaveCount(1, {timeout: 30000});
  await expect(page.locator('.game-library-item')).toContainText(username);
  await expect(page.getByText(`Signed in as ${username}`)).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Sign out', exact: true})).toHaveCount(0);
  expect(await page.locator('.app-header').evaluate(header => header.getBoundingClientRect().top)).toBe(0);
  const gameHref = (await page.locator('.game-library-item').getAttribute('href'))!;
  await page.getByRole('link', {name: 'Settings', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Account', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Sign out', exact: true})).toHaveCount(0);
  await settingsSection(page, 'Coach & animations');
  await page.getByRole('radio', {name: 'Ingrid', exact: true}).click();
  await expect(page.locator('.coach-preference-status')).toContainText('Saved');
  await page.getByLabel('Coach motion', {exact: true}).selectOption('still');
  await expect(page.locator('.coach-motion-preference-status')).toContainText('Saved');
  await page.getByLabel('Piece & interface motion', {exact: true}).selectOption('natural');
  await expect(page.locator('.motion-preference-status')).toContainText('Saved');
  await settingsSection(page, 'Sound');
  const sound = page.getByRole('region', {name: 'Sound', exact: true});
  await sound.getByRole('checkbox', {name: /^Board moves/}).uncheck();
  await expect(sound.locator('.preference-status')).toHaveAttribute('data-state', 'saved');
  const voiceSave = page.waitForResponse(response => response.url().endsWith('/api/preferences/audio') && response.request().method() === 'PUT');
  await sound.getByLabel('Coach voice', {exact: true}).selectOption('manual');
  expect((await voiceSave).ok()).toBe(true);
  await expect(sound.locator('.preference-status')).toHaveAttribute('data-state', 'saved');
  await expect(sound.getByRole('checkbox', {name: /^Review accents/})).toHaveCount(0);
  const ownerAudio = {enabled: true, volume: .35, board: false, practice: true, voice: 'manual'};
  expect(await (await page.request.get('/api/preferences/audio')).json()).toEqual(ownerAudio);
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  const jobs = await (await page.request.get('/api/jobs')).json();
  expect(jobs).toHaveLength(1);
  expect(jobs[0].kind).toBe('sync');
  expect(jobs[0].positions_triaged).toBe(0);
  await page.screenshot({path: `test-results/accounts-${info.project.name}.png`, fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`${gameHref}?ply=3`);
  await page.getByRole('button', {name: 'Mute sound on this device', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Unmute sound on this device', exact: true})).toHaveAttribute('aria-pressed', 'true');
  expect(await (await page.request.get('/api/preferences/audio')).json()).toEqual(ownerAudio);

  const second = await browser.newContext({baseURL: 'http://127.0.0.1:8766', extraHTTPHeaders});
  try {
    const device = await second.newPage();
    await captureAudio(device);
    await device.goto(`${gameHref}?ply=3`);
    await device.getByLabel('Username', {exact: true}).fill(username);
    await device.getByLabel('Password', {exact: true}).fill('test-only-password');
    await device.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(device).toHaveURL(`${gameHref}?ply=3`);
    await expect(device.locator('.game-player-name', {hasText: username})).toBeVisible();
    await expect(device.locator('.game-player-name', {hasText: 'FixtureOpponent'})).toBeVisible();
    await expect(device.locator('.review-coach .coach-avatar')).toHaveAttribute('data-motion', 'still');
    await expect(device.locator('.review-coach .coach-avatar')).toHaveAttribute('data-coach', 'woman-blonde');
    await expect(device.locator('.game-move-list').getByRole('button', {name: /^2\. g4(?:, .+)?$/})).toHaveAttribute('aria-current', 'step');
    // Sound choices follow the account, while the first device's quick mute does not.
    await expect(device.getByRole('button', {name: 'Mute sound on this device', exact: true})).toHaveAttribute('aria-pressed', 'false');
    expect(await (await device.request.get('/api/preferences/audio')).json()).toEqual(ownerAudio);
    expect(await audioCues(device)).toEqual([]);
    await device.getByRole('button', {name: 'Mute sound on this device', exact: true}).click();
    await device.getByRole('link', {name: 'Games', exact: true}).click();
    await expect(device.locator('.game-library-item')).toHaveCount(1);
    await device.getByRole('link', {name: 'Home', exact: true}).click();
    const recentGames = device.getByRole('region', {name: 'Recent games', exact: true});
    await expect(recentGames.locator('.game-library-item')).toHaveCount(1);
    await expect(recentGames).toContainText(username);
    await device.getByRole('link', {name: 'Settings', exact: true}).click();
    await device.getByText('Change Chess.com connection', {exact: true}).click();
    await expect(device.getByLabel('Remembered Chess.com username')).toHaveValue(username);
    await settingsSection(device, 'Coach & animations');
    await expect(device.getByLabel('Coach motion', {exact: true})).toHaveValue('still');
    await expect(device.getByLabel('Piece & interface motion', {exact: true})).toHaveValue('natural');
    await expect(device.getByRole('radio')).toHaveCount(30);
    await expect(device.getByRole('radio', {name: 'Ingrid', exact: true})).toBeChecked();
    await expect(device.getByLabel('Coach motion', {exact: true})).toBeEnabled();
    await settingsSection(device, 'Sound');
    const deviceSound = device.getByRole('region', {name: 'Sound', exact: true});
    await expect(deviceSound.getByRole('checkbox', {name: /^Board moves/})).not.toBeChecked();
    await expect(deviceSound.getByRole('checkbox', {name: /^Practice feedback/})).toBeChecked();
    await expect(deviceSound.getByLabel('Coach voice', {exact: true})).toHaveValue('manual');
    await device.reload();
    await expect(deviceSound.getByLabel('Coach voice', {exact: true})).toHaveValue('manual');
    await expect(deviceSound.getByRole('checkbox', {name: /^Review accents/})).toHaveCount(0);
    await expect(deviceSound.getByRole('button', {name: 'Test sound', exact: true})).toBeDisabled();
    await expect(device.getByRole('region', {name: 'Account', exact: true})).toHaveCount(0);
    await settingsSection(device, 'Account');
    await expect(device).toHaveURL('/settings?section=account');
    await expect(device.getByRole('radio')).toHaveCount(0);
    await expect(device.getByRole('region', {name: 'Account', exact: true})).toContainText(`Signed in as ${username}`);
    await device.getByRole('button', {name: 'Sign out', exact: true}).click();
    await page.reload();
    await page.getByRole('link', {name: 'Settings', exact: true}).click();
    await settingsSection(page, 'Account');
    const account = page.getByRole('region', {name: 'Account', exact: true});
    await expect(account).toContainText(`Signed in as ${username}`);
    await expect(account.getByRole('button', {name: 'Sign out all devices', exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/account-settings-${info.project.name}.png`, fullPage: true});
    await device.getByRole('button', {name: 'New here? Create an account'}).click();
    await device.getByLabel('Username', {exact: true}).fill(`${username}-other`);
    await device.getByLabel('Password', {exact: true}).fill('test-only-password');
    await submitSignup(device);
    await device.getByRole('button', {name: 'Continue', exact: true}).click();
    await device.getByRole('button', {name: 'Finish for now', exact: true}).click();
    await device.getByRole('link', {name: 'Home', exact: true}).click();
    await expect(recentGames.getByText('Your next insight starts with a game.', {exact: true})).toBeVisible();
    await expect(recentGames.locator('.game-library-item')).toHaveCount(0);
    await expect(recentGames).not.toContainText(username);
    await device.getByRole('link', {name: 'Settings', exact: true}).click();
    await settingsSection(device, 'Coach & animations');
    await expect(device.getByLabel('Coach motion', {exact: true})).toBeEnabled();
    await expect(device.getByLabel('Coach motion', {exact: true})).toHaveValue('system');
    await expect(device.getByLabel('Piece & interface motion', {exact: true})).toHaveValue('system');
    await expect(device.getByRole('radio', {name: 'Walter', exact: true})).toBeChecked();
    await settingsSection(device, 'Sound');
    await expect(deviceSound.getByRole('checkbox', {name: /^Board moves/})).toBeChecked();
    await expect(deviceSound.getByRole('checkbox', {name: /^Practice feedback/})).toBeChecked();
    await expect(deviceSound.getByLabel('Coach voice', {exact: true})).toHaveValue('automatic');
    await expect(deviceSound.getByRole('checkbox', {name: /^Review accents/})).toHaveCount(0);
    await expect(deviceSound.getByRole('button', {name: 'Unmute this device', exact: true})).toHaveCount(0);
    // Replacing the signed-in account also replaces its muted audio provider.
    await deviceSound.getByRole('button', {name: 'Test sound', exact: true}).click();
    await expect.poll(() => audioCues(device)).toEqual(['move']);
    expect(await (await device.request.get('/api/preferences/audio')).json()).toEqual({enabled: true, volume: .35, board: true, practice: true, voice: 'automatic'});
    await device.getByRole('link', {name: 'Games', exact: true}).click();
    await expect(device.locator('.game-library-item')).toHaveCount(0);
    await expect(device.getByLabel('Remembered Chess.com username')).toHaveCount(0);
    await device.getByRole('link', {name: 'Update games', exact: true}).click();
    await expect(device.getByLabel('Remembered Chess.com username')).toHaveValue('');
    await device.goto(`${gameHref}?ply=3`);
    await expect(device.getByRole('alert')).toContainText('Game not found');
    await expect(device.locator('.game-player-name')).toHaveCount(0);
    await device.getByRole('link', {name: 'All games', exact: true}).click();
    await expect(device.locator('.game-library-item')).toHaveCount(0);
  } finally { await second.close(); }
});

for (const connected of [false, true]) {
  test(`one-time onboarding ${connected ? 'saves both providers and explains fetching' : 'allows no usernames and explains PGN import'}`, async ({page}, info) => {
    const username = `welcome-${connected ? 'sites' : 'pgn'}-${info.project.name}`;
    await page.goto('/');
    await page.getByRole('button', {name: 'New here? Create an account'}).click();
    await page.getByLabel('Username', {exact: true}).fill(username);
    await page.getByLabel('Password', {exact: true}).fill('test-only-password');
    await submitSignup(page);
    await expect(page.getByRole('heading', {name: 'Where do you play?'})).toBeVisible();
    if (connected) {
      await page.getByLabel('Chess.com username (optional)', {exact: true}).fill(username);
      await page.getByLabel('Lichess username (optional)', {exact: true}).fill(`${username}-li`);
    }
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Bring in your first games'})).toBeVisible();
    expect((await (await page.request.get('/api/auth/me')).json()).user.onboarding_completed).toBe(false);
    expect(await (await page.request.get('/api/jobs')).json()).toEqual([]);
    // An interrupted welcome resumes with saved choices, without starting analysis.
    await page.reload();
    await expect(page.getByLabel('Chess.com username (optional)', {exact: true})).toHaveValue(connected ? username : '');
    await expect(page.getByLabel('Lichess username (optional)', {exact: true})).toHaveValue(connected ? `${username}-li` : '');
    await page.getByRole('button', {name: 'Continue', exact: true}).click();
    if (connected) await expect(page.getByText('Your Chess.com and Lichess usernames are saved.')).toBeVisible();
    else await expect(page.getByText('No connected account needed.', {exact: false})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `account-test-results/onboarding-${connected ? 'sites' : 'pgn'}-${info.project.name}.png`, fullPage: true});
    if (!connected) {
      await page.route('**/api/auth/onboarding/complete', route => route.fulfill({status: 503, json: {detail: 'Please retry completion.'}}));
      await page.getByRole('button', {name: 'Open imports', exact: true}).click();
      await expect(page.getByRole('alert')).toContainText('Please retry completion.');
      expect((await (await page.request.get('/api/auth/me')).json()).user.onboarding_completed).toBe(false);
      await page.unroute('**/api/auth/onboarding/complete');
    }
    await page.getByRole('button', {name: 'Open imports', exact: true}).click();
    await expect(page).toHaveURL(`/settings?import=${connected ? 'chesscom' : 'pgn'}`);
    await expect(page.getByRole('heading', {name: connected ? 'Import from Chess.com' : 'Import PGN', exact: true})).toBeVisible();
    expect((await (await page.request.get('/api/auth/me')).json()).user.onboarding_completed).toBe(true);
    await page.reload();
    await expect(page.getByRole('heading', {name: 'Settings', exact: true})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'Where do you play?'})).toHaveCount(0);
  });
}

test('Study progress and selected coach resume on another device without leaking to another account', async ({page, browser, extraHTTPHeaders}, info) => {
  const username = `study-owner-${info.project.name}`;
  const password = 'test-only-password';
  async function json<T>(pending: Promise<APIResponse>): Promise<T> {
    const response = await pending;
    expect(response.ok()).toBe(true);
    return response.json();
  }
  async function signup(device: Page, name: string) {
    await device.goto('/');
    await device.getByRole('button', {name: 'New here? Create an account'}).click();
    await device.getByLabel('Username', {exact: true}).fill(name);
    await device.getByLabel('Password', {exact: true}).fill(password);
    await submitSignup(device);
    await device.getByRole('button', {name: 'Continue', exact: true}).click();
    await device.getByRole('button', {name: 'Finish for now', exact: true}).click();
    await expect(device.getByRole('heading', {name: 'Home', exact: true})).toBeVisible();
  }
  await signup(page, username);
  await page.getByRole('link', {name: 'Settings', exact: true}).click();
  await settingsSection(page, 'Coach & animations');
  const coachSave = page.waitForResponse(response => response.url().endsWith('/api/preferences/coach') && response.request().method() === 'PATCH');
  await page.getByRole('radio', {name: 'Scout', exact: true}).click();
  expect((await coachSave).ok()).toBe(true);
  await expect(page.getByRole('radio', {name: 'Scout', exact: true})).toBeChecked();
  const motionSave = page.waitForResponse(response => response.url().endsWith('/api/preferences/motion') && response.request().method() === 'PUT');
  await page.getByLabel('Piece & interface motion', {exact: true}).selectOption('still');
  expect((await motionSave).ok()).toBe(true);
  await expect(page.getByLabel('Piece & interface motion', {exact: true})).toHaveValue('still');

  const catalogue = await json<Schema['OpeningCatalogue']>(page.request.get('/api/openings/catalog?q=Italian%20Game&eco=C50&limit=50'));
  const line = catalogue.items.find(item => item.name === 'Italian Game')!;
  expect(line).toBeTruthy();
  await page.goto(`/study/openings/catalogue/${line.source_key}`);
  const enrollment = page.waitForResponse(response => new URL(response.url()).pathname === '/api/opening-studies' && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Add to study', exact: true}).click();
  const study: Schema['OpeningStudyView'] = await (await enrollment).json();
  await expect(page.getByRole('button', {name: 'Added to study', exact: true})).toBeDisabled();
  expect(study.color).toBe('white');

  const course = await json<Schema['LessonCourseView']>(page.request.get('/api/study/courses/italian-foundations'));
  await page.goto(`/study/openings/courses/${course.id}?revision=${course.revision}`);
  const start = page.waitForResponse(response => new URL(response.url()).pathname === '/api/study/lesson-sessions' && response.request().method() === 'POST');
  await page.locator('.lesson-chapters li').first().getByRole('button', {name: 'Start', exact: true}).click();
  const lesson: Schema['LessonSessionView'] = await (await start).json();
  for (const label of ['Continue', 'Play continuation', 'Continue']) {
    const command = page.waitForResponse(response => response.url().endsWith(`/lesson-sessions/${lesson.id}/command`));
    await page.getByRole('button', {name: label, exact: true}).click();
    expect((await command).ok()).toBe(true);
  }
  const savedLesson = await json<Schema['LessonSessionView']>(page.request.get(`/api/study/lesson-sessions/${lesson.id}`));
  expect(savedLesson.history.map(frame => frame.uci)).toEqual(['e2e4', 'e7e5']);
  expect(savedLesson.step.kind).toBe('decision');

  // The authenticated alias exists only in browser_app, not the production app.
  const identity = await json<Schema['Identity']>(page.request.get('/api/auth/me'));
  expect(identity.csrf).toBeTruthy();
  const fixture = await json<{session_id: string}>(page.request.post(`/api/__test/puzzle-fixture/private-${info.project.name}`, {
    headers: {Origin: 'http://127.0.0.1:8766', 'X-CSRF-Token': identity.csrf!},
  }));
  const puzzlePath = `/study/puzzles/sessions/${fixture.session_id}`;
  const lessonPath = `/study/openings/sessions/${lesson.id}`;
  await page.goto(puzzlePath);
  const puzzleMove = page.waitForResponse(response => response.url().endsWith(`/puzzle-sessions/${fixture.session_id}/move`));
  await page.locator('.board-shell [data-square="e2"]').click();
  await page.locator('.board-shell [data-square="e4"]').click();
  expect((await puzzleMove).ok()).toBe(true);
  const savedPuzzle = await json<Schema['PuzzleSessionView']>(page.request.get(`/api/puzzle-sessions/${fixture.session_id}`));
  expect(savedPuzzle.history.map(frame => frame.uci)).toEqual(['e2e4', 'e7e5']);

  const second = await browser.newContext({baseURL: 'http://127.0.0.1:8766', extraHTTPHeaders});
  try {
    const device = await second.newPage();
    await device.goto(lessonPath);
    await device.getByLabel('Username', {exact: true}).fill(username);
    await device.getByLabel('Password', {exact: true}).fill(password);
    await device.getByRole('button', {name: 'Sign in', exact: true}).click();
    await expect(device.getByRole('heading', {name: savedLesson.step.title, exact: true})).toBeVisible();
    await expect(device.locator('.review-coach .coach-avatar')).toHaveAttribute('data-coach', 'dog-collie');
    expect(await json<Schema['LessonSessionView']>(device.request.get(`/api/study/lesson-sessions/${lesson.id}`))).toEqual(savedLesson);
    await device.reload();
    await expect(device.locator('.board-shell [data-square="e5"] [data-piece="bP"]')).toBeVisible();
    await device.goto(puzzlePath);
    await expect(device.locator('.board-shell [data-square="e5"] [data-piece="bP"]')).toBeVisible();
    await expect(device.locator('.review-coach .coach-avatar')).toHaveAttribute('data-coach', 'dog-collie');
    expect(await json<Schema['PuzzleSessionView']>(device.request.get(`/api/puzzle-sessions/${fixture.session_id}`))).toEqual(savedPuzzle);
    await device.goto('/study/openings/studies');
    await expect(device.getByRole('article', {name: `${study.name} as white`, exact: true})).toBeVisible();
    await device.getByRole('link', {name: 'Home', exact: true}).click();
    const learning = device.getByRole('region', {name: 'Keep learning', exact: true});
    await expect(learning.locator(`a[href="${lessonPath}"]`)).toBeVisible();
    await expect(learning.getByRole('definition')).toHaveText(['1']);
    await device.getByRole('link', {name: 'Settings', exact: true}).click();
    await settingsSection(device, 'Coach & animations');
    await expect(device.getByLabel('Piece & interface motion', {exact: true})).toHaveValue('still');
    await settingsSection(device, 'Account');
    await device.getByRole('button', {name: 'Sign out', exact: true}).click();

    await signup(device, `study-guest-${info.project.name}`);
    await expect(learning.locator('a[href^="/study/openings/sessions/"]')).toHaveCount(0);
    await expect(learning.getByRole('definition')).toHaveText(['0']);
    expect((await json<Schema['OpeningStudyLibrary']>(device.request.get('/api/opening-studies'))).items).toEqual([]);
    expect((await json<Schema['LessonLibrary']>(device.request.get('/api/study/courses'))).resume).toEqual([]);
    expect((await json<Schema['PuzzleLibrary']>(device.request.get('/api/puzzles'))).resume).toEqual([]);
    await device.goto('/study/openings/studies');
    await expect(device.getByText('No lines selected yet.', {exact: false})).toBeVisible();
    await device.goto('/study/openings');
    await expect(device.getByRole('heading', {name: 'Continue learning', exact: true})).toHaveCount(0);
    await device.goto('/study/puzzles');
    await expect(device.getByRole('heading', {name: 'No puzzles available yet.', exact: true})).toBeVisible();
    for (const [path, apiPath, message] of [
      [lessonPath, `/api/study/lesson-sessions/${lesson.id}`, 'Lesson session not found'],
      [puzzlePath, `/api/puzzle-sessions/${fixture.session_id}`, 'Puzzle session not found'],
    ]) {
      expect((await device.request.get(apiPath)).status()).toBe(404);
      await device.goto(path);
      await expect(device.getByRole('alert')).toContainText(message);
      await expect(device.locator('.board-shell')).toHaveCount(0);
    }
    expect((await device.request.get(`/api/opening-studies/${study.id}`)).status()).toBe(404);
    // Signing out one device and using another account never changes the owner's session.
    await page.reload();
    await expect(page.locator('.board-shell [data-square="e5"] [data-piece="bP"]')).toBeVisible();
    expect(await json<Schema['PuzzleSessionView']>(page.request.get(`/api/puzzle-sessions/${fixture.session_id}`))).toEqual(savedPuzzle);
  } finally { await second.close(); }
});
