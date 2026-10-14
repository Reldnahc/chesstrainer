import { PHONE_QUERY, useMediaQuery } from "./mediaQuery";

export { PHONE_QUERY };

/** True while the viewport is phone-sized; updates when it crosses the breakpoint. */
export default function usePhone() {
  return useMediaQuery(PHONE_QUERY);
}
