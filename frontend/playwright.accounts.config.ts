import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const root = path.resolve('..');
const python = process.env.TEST_PYTHON || path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
export default defineConfig({
  testDir: './tests', testMatch: '**/accounts.spec.ts', workers: 1,
  outputDir: './account-test-results',
  use: {baseURL: 'http://127.0.0.1:8766', trace: 'retain-on-failure'},
  // Each project has its own client quota while retaining production auth limits.
  projects: [{name: 'desktop', use: {...devices['Desktop Chrome'], extraHTTPHeaders: {'X-Forwarded-For': '192.0.2.1'}}},
             {name: 'mobile', use: {...devices['iPhone 13'], defaultBrowserType: 'chromium', extraHTTPHeaders: {'X-Forwarded-For': '192.0.2.2'}}}],
  webServer: {
    command: `"${python}" -m uvicorn browser_app:create_app --app-dir backend/tests --factory --host 127.0.0.1 --port 8766 --proxy-headers --forwarded-allow-ips 127.0.0.1`,
    cwd: root, url: 'http://127.0.0.1:8766/api/auth/me', reuseExistingServer: false,
    env: {DATABASE_PATH: path.join(root, `data/account-ui-test-${Date.now()}.sqlite3`), ACCOUNTS_ENABLED: 'true', SESSION_SECURE: 'false', PUBLIC_ORIGIN: 'http://127.0.0.1:8766', LAN_ACCESS_TOKEN: ''},
  },
});
