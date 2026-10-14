import { REDUCED_MOTION_QUERY, useMediaQuery } from "./mediaQuery";

// Every consumer reads the same event-driven snapshot (see mediaQuery.ts), so
// portraits and preference controls change together. Without a window, assume reduced.
export const useReducedMotion = () => useMediaQuery(REDUCED_MOTION_QUERY, true);
