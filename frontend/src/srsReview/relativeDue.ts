/** Format a due time against the caller's clock without scheduling updates. */
export function relativeDue(value: string, now: number) {
  const seconds = Math.max(0, (new Date(value).getTime() - now) / 1000);
  if (seconds < 60) return "in less than a minute";
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: "always",
  });
  if (seconds < 3600)
    return formatter.format(Math.round(seconds / 60), "minute");
  if (seconds < 86400)
    return formatter.format(Math.round(seconds / 3600), "hour");
  return formatter.format(Math.round(seconds / 86400), "day");
}
