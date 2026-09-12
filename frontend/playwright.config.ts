import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const root = path.resolve('..');
const python = process.env.TEST_PYTHON || path.join(root, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1,
  use: {baseURL: 'http://127.0.0.1:8765', trace: 'retain-on-failure'},
  projects: [{name: 'desktop', use: {...devices['Desktop Chrome'], viewport: {width: 1440, height: 1100}}},
             {name: 'mobile', use: {...devices['iPhone 13'], defaultBrowserType: 'chromium'}}],
  webServer: {
    command: `"${python}" -m uvicorn browser_app:create_app --app-dir backend/tests --factory --host 127.0.0.1 --port 8765`,
    cwd: root, url: 'http://127.0.0.1:8765/api/health', reuseExistingServer: false,
    env: {DATABASE_PATH: path.join(root, `data/ui-test-${Date.now()}.sqlite3`), LLM_ENABLED: 'false', LAN_ACCESS_TOKEN: ''},
  },
});
