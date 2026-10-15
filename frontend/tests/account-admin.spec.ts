import {test, expect, type Page} from '@playwright/test';
import type {Schema} from '../src/api';

const sections = (page: Page) => page.getByRole('navigation', {name: 'Settings sections'});
const section = (page: Page) => page.getByRole('region', {name: 'Accounts', exact: true});
const row = (page: Page, name: string) => section(page).locator('.settings-tool-row').filter({has: page.getByRole('heading', {name})});

function account(id: string, username: string, admin = false): Schema['ManagedAccount'] {
  return {id, username, admin, disabled: false, created: '2026-10-02T12:00:00Z'};
}

async function signedIn(page: Page, admin: boolean, password_change_required = false) {
  const user: Schema['Account'] = {id: 'keeper-id', username: 'keeper', admin, chesscom_username: '', onboarding_completed: true, password_change_required};
  await page.route('**/api/auth/me', route => route.fulfill({json: {enabled: true, user, csrf: 'test-csrf'} satisfies Schema['Identity']}));
  await page.route('**/api/jobs', route => route.fulfill({json: []}));
}

test('members never see account administration', async ({page}) => {
  await signedIn(page, false);
  await page.goto('/settings?section=account');
  await expect(page.getByRole('region', {name: 'Account', exact: true})).toBeVisible();
  await expect(section(page)).toHaveCount(0);
});

test('administrators reset, disable, promote and delete other accounts', async ({page}, info) => {
  await signedIn(page, true);
  const accounts = [account('keeper-id', 'keeper', true), account('friend-id', 'friend'), account('cousin-id', 'cousin')];
  const calls: string[] = [];
  await page.route('**/api/auth/accounts**', async route => {
    const request = route.request();
    const [, , , , id, action] = new URL(request.url()).pathname.split('/');
    if (request.method() === 'GET') return route.fulfill({json: {accounts, signups_open: false} satisfies Schema['ManagedAccounts']});
    calls.push(`${request.method()} ${id}${action ? ' ' + action : ''} ${request.postData() ?? ''}`.trim());
    const target = accounts.findIndex(item => item.id === id);
    if (request.method() === 'DELETE') accounts.splice(target, 1);
    else if (action === 'admin') accounts[target].admin = true;
    else if (action === 'access') accounts[target].disabled = request.postDataJSON().disabled;
    return route.fulfill({json: {ok: true} satisfies Schema['Ok']});
  });
  await page.goto('/settings');
  // Administration sits under the signed-in account rather than adding another tab.
  await sections(page).getByRole('link', {name: 'Account', exact: true}).click();
  await expect(page).toHaveURL('/settings?section=account');
  await expect(page.getByRole('region', {name: 'Account', exact: true})).toBeVisible();
  await expect(section(page).getByRole('heading', {level: 3})).toHaveText(['Sign-ups', 'Add member', 'keeper (you)', 'friend', 'cousin']);
  // An administrator cannot change their own account here.
  await expect(row(page, 'keeper (you)').getByRole('button')).toHaveCount(0);
  await expect(row(page, 'friend').getByRole('button')).toHaveText(['Reset password', 'Make administrator', 'Disable', 'Delete']);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-${info.project.name}.png`, fullPage: true});

  await row(page, 'friend').getByRole('button', {name: 'Reset password'}).click();
  const field = section(page).getByLabel('Temporary password for friend');
  await expect(field).toBeFocused();
  await field.fill('a-new-password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-password-${info.project.name}.png`, fullPage: true});
  await row(page, 'friend').getByRole('button', {name: 'Set temporary password'}).click();
  await expect(page.getByRole('region', {name: 'Notifications'}).getByRole('status')).toHaveText('Set a temporary password for friend and signed them out. They will choose their own when they next sign in.');
  await expect(field).toHaveCount(0);

  await row(page, 'friend').getByRole('button', {name: 'Disable'}).click();
  await expect(row(page, 'friend')).toContainText('Member · Disabled');
  await row(page, 'friend').getByRole('button', {name: 'Enable'}).click();
  await expect(row(page, 'friend')).not.toContainText('Disabled');
  await row(page, 'friend').getByRole('button', {name: 'Make administrator'}).click();
  await expect(row(page, 'friend')).toContainText('Administrator');
  await expect(row(page, 'friend').getByRole('button', {name: 'Make administrator'})).toHaveCount(0);

  await row(page, 'cousin').getByRole('button', {name: 'Delete'}).click();
  await expect(row(page, 'cousin').getByRole('button')).toHaveText(['Delete account and games', 'Keep it']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-delete-${info.project.name}.png`, fullPage: true});
  await row(page, 'cousin').getByRole('button', {name: 'Keep it'}).click();
  await expect(row(page, 'cousin').getByRole('button', {name: 'Delete', exact: true})).toBeVisible();
  await row(page, 'cousin').getByRole('button', {name: 'Delete', exact: true}).click();
  await row(page, 'cousin').getByRole('button', {name: 'Delete account and games'}).click();
  await expect(page.getByRole('region', {name: 'Notifications'}).getByRole('status')).toHaveText('Deleted cousin and their games.');
  await expect(section(page).getByRole('heading', {level: 3})).toHaveText(['Sign-ups', 'Add member', 'keeper (you)', 'friend']);
  expect(calls).toEqual([
    'POST friend-id password {"password":"a-new-password"}',
    'POST friend-id access {"disabled":true}',
    'POST friend-id access {"disabled":false}',
    'POST friend-id admin',
    'DELETE cousin-id',
  ]);
});

test('administrators add members and open sign-ups', async ({page}, info) => {
  await signedIn(page, true);
  const accounts = [account('keeper-id', 'keeper', true)];
  let signups_open = false;
  const calls: string[] = [];
  await page.route('**/api/auth/accounts', async route => {
    const request = route.request();
    if (request.method() === 'GET') return route.fulfill({json: {accounts, signups_open} satisfies Schema['ManagedAccounts']});
    calls.push(`POST accounts ${request.postData()}`);
    accounts.push(account('friend-id', request.postDataJSON().username));
    return route.fulfill({status: 201, json: {ok: true} satisfies Schema['Ok']});
  });
  await page.route('**/api/auth/signups', async route => {
    calls.push(`PUT signups ${route.request().postData()}`);
    signups_open = route.request().postDataJSON().open;
    return route.fulfill({json: {ok: true} satisfies Schema['Ok']});
  });
  await page.goto('/settings?section=account');
  await expect(row(page, 'Sign-ups')).toContainText('Closed. Only administrators can add accounts.');
  await row(page, 'Add member').getByRole('button', {name: 'Add member'}).click();
  const name = row(page, 'Add member').getByLabel('Username');
  await expect(name).toBeFocused();
  await name.fill('Friend');
  await row(page, 'Add member').getByLabel('Temporary password').fill('a-temporary-pass');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-accounts-add-${info.project.name}.png`, fullPage: true});
  await row(page, 'Add member').getByRole('button', {name: 'Add member'}).click();
  await expect(page.getByRole('region', {name: 'Notifications'}).getByRole('status')).toHaveText('Added friend. Pass on the temporary password; they will choose their own when they first sign in.');
  await expect(row(page, 'Add member').getByLabel('Username')).toHaveCount(0);
  await expect(row(page, 'friend')).toContainText('Member');

  await row(page, 'Sign-ups').getByRole('button', {name: 'Open sign-ups'}).click();
  await expect(row(page, 'Sign-ups')).toContainText('Open. Anyone who can reach this server can create an account.');
  await row(page, 'Sign-ups').getByRole('button', {name: 'Close sign-ups'}).click();
  await expect(row(page, 'Sign-ups')).toContainText('Closed.');
  expect(calls).toEqual([
    'POST accounts {"username":"friend","password":"a-temporary-pass"}',
    'PUT signups {"open":true}',
    'PUT signups {"open":false}',
  ]);
});

for (const open of [false, true]) {
  test(`the sign-in page ${open ? 'offers' : 'does not offer'} account creation when sign-ups are ${open ? 'open' : 'closed'}`, async ({page}) => {
    await page.route('**/api/auth/me', route => route.fulfill({json: {enabled: true, user: null, signups_open: open} satisfies Schema['Identity']}));
    await page.goto('/');
    await expect(page.getByRole('heading', {name: 'Welcome back'})).toBeVisible();
    const create = page.getByRole('button', {name: 'New here? Create an account'});
    if (!open) {
      await expect(create).toHaveCount(0);
      await expect(page.getByText('New here? Ask whoever runs this Fieldwork server for an account.')).toBeVisible();
      return;
    }
    await create.click();
    await expect(page.getByRole('heading', {name: 'Create your account'})).toBeVisible();
  });
}

test('everyone can change their own password in Settings', async ({page}, info) => {
  await signedIn(page, false);
  const bodies: unknown[] = [];
  await page.route('**/api/auth/password', route => {
    const body = route.request().postDataJSON();
    bodies.push(body);
    if (body.current_password !== 'old-password') return route.fulfill({status: 403, json: {detail: 'Your current password is incorrect.'}});
    return route.fulfill({json: {user: {id: 'keeper-id', username: 'keeper', admin: false, chesscom_username: '', onboarding_completed: true, password_change_required: false}} satisfies Schema['AccountProfile']});
  });
  await page.goto('/settings?section=account');
  const password = page.getByRole('region', {name: 'Password', exact: true});
  await password.getByLabel('Current password').fill('old-password');
  await password.getByLabel('New password', {exact: true}).fill('brand-new-password');
  await password.getByLabel('Confirm new password').fill('brand-new-passwerd');
  await password.getByRole('button', {name: 'Change password'}).click();
  await expect(password.getByRole('alert')).toHaveText('The new passwords do not match.');
  expect(bodies).toEqual([]);
  await password.getByLabel('Confirm new password').fill('brand-new-password');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/settings-password-${info.project.name}.png`, fullPage: true});
  await password.getByRole('button', {name: 'Change password'}).click();
  // The confirmation is a page banner, like Settings' other results.
  await expect(page.getByRole('region', {name: 'Notifications'})).toContainText('Password changed. Your other devices are signed out.');
  await expect(password.getByLabel('Current password')).toHaveValue('');
  expect(bodies).toEqual([{current_password: 'old-password', new_password: 'brand-new-password'}]);
});

test('a temporary password must be replaced before the app opens', async ({page}, info) => {
  await signedIn(page, false, true);
  await page.route('**/api/auth/password', route => route.fulfill({json: {user: {
    id: 'keeper-id', username: 'keeper', admin: false, chesscom_username: '', onboarding_completed: true, password_change_required: false,
  }} satisfies Schema['AccountProfile']}));
  await page.goto('/settings');
  await expect(page.getByRole('heading', {name: 'Choose a new password'})).toBeVisible();
  await expect(page.getByRole('navigation', {name: 'Settings sections'})).toHaveCount(0);
  await page.getByLabel('Temporary password').fill('temporary-pass');
  await page.getByLabel('New password', {exact: true}).fill('my-own-password');
  await page.getByLabel('Confirm new password').fill('my-own-password');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({path: `test-results/account-temporary-password-${info.project.name}.png`, fullPage: true});
  await page.getByRole('button', {name: 'Save and continue'}).click();
  await expect(sections(page)).toBeVisible();
});
