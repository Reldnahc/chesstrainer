// Lint for the app, the development tools, their tests and the build scripts.
// `npm run build` runs it with no warnings allowed (scripts/build.mjs), so a
// finding fails the build like a type error. An intended exception is written
// at the line as `// eslint-disable-next-line <rule> -- <why>` (or a disable/enable
// pair around one short block); never for a whole file. See docs/TESTING.md.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

const reactSources = ["src/**/*.{ts,tsx}", "coach-studio/**/*.{ts,tsx}", "intelligence-lab/**/*.{ts,tsx}", "audio-studio/**/*.{ts,tsx}",
  // Test fixtures that render components.
  "audio-tests/fixtures/**/*.{ts,tsx}", "studio-tests/fixtures/**/*.{ts,tsx}"];

export default tseslint.config(
  // Generated output and reports (the frontend entries in ../.gitignore) and the generated API types.
  { ignores: ["dist/**", "audio-studio-dist/**", "*-results*/**", "playwright-report/**", "blob-report/**", "playwright/.cache/**", "node_modules/**", "src/api.generated.ts"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore marks a value that is deliberately unused.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    // Every React rule, including the React Compiler's, for code that renders.
    files: reactSources,
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Promise misuse needs type information: a promise nobody awaits or handles, or one
    // passed where a plain callback is expected (whose rejection nobody would see).
    // Event-handler attributes may be async; each handler reports its own failures.
    files: [...reactSources, "tests/**/*.ts", "audio-tests/**/*.ts", "studio-tests/**/*.ts", "intelligence-tests/**/*.ts", "type-tests/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.browser-tests.json", "./tsconfig.contracts.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "*.config.{js,ts}", "vite.*.ts", "playwright.*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    // Compile-time contract checks: each statement exists only to be type-checked.
    files: ["type-tests/**/*.ts"],
    rules: { "@typescript-eslint/no-unused-expressions": "off", "@typescript-eslint/no-floating-promises": "off" },
  },
);
