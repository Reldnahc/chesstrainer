// Studio cases are independent pages on a stateless dev server, so they run in parallel.
// PLAYWRIGHT_WORKERS overrides the default: 3 on CI's 4 cores, 6 locally.
export const studioWorkers = Number(process.env.PLAYWRIGHT_WORKERS) || (process.env.CI ? 3 : 6);
