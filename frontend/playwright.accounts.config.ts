import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const root = path.resolve('..');
const python = process.env.TEST_PYTHON || path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
export default defineConfig({
  testDir: './tests', testMatch: '**/accounts.spec.ts', workers: 1,
  use: {baseURL: 'http://127.0.0.1:8766', trace: 'retain-on-failure'},
  projects: [{name: 'desktop', use: {...devices['Desktop Chrome']}},
             {name: 'mobile', use: {...devices['iPhone 13'], defaultBrowserType: 'chromium'}}],
  webServer: {
    command: `"${python}" -m uvicorn browser_app:create_app --app-dir backend/tests --factory --host 127.0.0.1 --port 8766`,
    cwd: root, url: 'http://127.0.0.1:8766/api/auth/me', reuseExistingServer: false,
    env: {DATABASE_PATH: path.join(root, `data/account-ui-test-${Date.now()}.sqlite3`), ACCOUNTS_ENABLED: 'true', SESSION_SECURE: 'false', PUBLIC_ORIGIN: 'http://127.0.0.1:8766', LAN_ACCESS_TOKEN: ''},
  },
});
