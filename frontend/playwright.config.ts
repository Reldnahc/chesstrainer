import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { balancedShardFiles } from './playwright.shared';

const root = path.resolve('..');
const python = process.env.TEST_PYTHON || path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
// Each parallel worker gets its own application server and database, so tests never
// share state across workers. Files still run in order within a worker.
const workers = Number(process.env.PLAYWRIGHT_WORKERS) || (process.env.CI ? 2 : 4);
const port = (slot: number) => slot === 0 ? 8765 : 8770 + slot;
// Playwright sets this in each worker before it loads the config; the runner itself is slot 0.
const slot = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
const stamp = Date.now();
// On CI each matrix shard runs a duration-balanced set of whole files (see playwright.shared.ts).
const shardFiles = balancedShardFiles('tests', ['accounts.spec.ts']);
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers,
  testIgnore: '**/accounts.spec.ts', ...(shardFiles ? {testMatch: shardFiles} : {}),
  use: {baseURL: `http://127.0.0.1:${port(slot)}`, trace: 'retain-on-failure'},
  projects: [{name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 1100}}},
             {name: 'mobile', use: {...devices['iPhone 13'], defaultBrowserType: 'chromium'}}],
  webServer: Array.from({length: workers}, (_, server) => ({
    command: `"${python}" -m uvicorn browser_app:create_app --app-dir backend/tests --factory --host 127.0.0.1 --port ${port(server)}`,
    cwd: root, url: `http://127.0.0.1:${port(server)}/api/health`, reuseExistingServer: false,
    env: {DATABASE_PATH: path.join(root, `data/ui-test-${stamp}-${server}.sqlite3`), ACCOUNTS_ENABLED: 'false', LAN_ACCESS_TOKEN: ''},
  })),
});
