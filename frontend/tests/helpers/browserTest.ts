import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

export * from "@playwright/test";

type PageErrorOptions = {
  /** Uncaught page errors a spec provokes on purpose; any other one fails the test. */
  expectedPageErrors: readonly RegExp[];
};

/** Watches every page in `context`, including ones opened later, for uncaught errors.
 * `check()` fails with the ones `expected` does not allow. */
export function watchPageErrors(context: BrowserContext, expected: readonly RegExp[] = []) {
  const errors: string[] = [];
  const watch = (page: Page) =>
    page.on("pageerror", error => {
      const text = `${error.name}: ${error.message}`;
      if (!expected.some(pattern => pattern.test(text))) errors.push(text);
    });
  context.pages().forEach(watch);
  context.on("page", watch);
  return { check: () => expect(errors, "uncaught page errors").toEqual([]) };
}

/** Playwright's test, with every page in the test's context watched for uncaught
 * errors. A test page or component that throws fails the test that drove it, even
 * when every assertion still passes. Every browser spec imports `test` from here; a
 * context a spec opens itself (a second device) uses watchPageErrors. */
export const test = base.extend<PageErrorOptions>({
  expectedPageErrors: [[], { option: true }],
  context: async ({ context, expectedPageErrors }, use) => {
    const errors = watchPageErrors(context, expectedPageErrors);
    await use(context);
    errors.check();
  },
});
