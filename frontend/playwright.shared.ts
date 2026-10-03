// Studio cases are independent pages on a stateless dev server, so they run in parallel.
// PLAYWRIGHT_WORKERS overrides the default: 2 on CI's 4 cores, 6 locally.
export const studioWorkers = Number(process.env.PLAYWRIGHT_WORKERS) || (process.env.CI ? 2 : 6);
// Whole-family studio checks take 10 to 20 s alone; sharing CI's cores with other
// workers can push them past the 30 s default. Locally the default still applies.
export const studioTimeout = process.env.CI ? 60_000 : 30_000;
