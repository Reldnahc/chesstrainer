// Small reader-facing formats shared by the game lists, Insights and Study.

/** "game" for one, "games" otherwise (or an irregular plural), for a count shown apart from its word. */
export const pluralWord = (count: number, word: string, many = `${word}s`) =>
  count === 1 ? word : many;

/** "1 game", "3 games" (or an irregular plural). */
export const plural = (count: number, word: string, many = `${word}s`) =>
  `${count} ${pluralWord(count, word, many)}`;

/** A PGN date ("2026.10.14") or ISO day ("2026-10-14") as a real calendar day, or
 * null for unknown parts ("2026.??.??") and impossible dates (2026.02.31). */
export function pgnDate(value: string | null | undefined): { iso: string; date: Date } | null {
  const day = value && /^\d{4}[.-]\d{2}[.-]\d{2}$/.test(value) ? value.replaceAll(".", "-") : null;
  if (!day) return null;
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
    ? { iso: day, date }
    : null;
}

/** "Oct 14, 2026" (or "Oct 14" without the year), in the reader's locale. */
export function shortDate(
  value: string | null | undefined,
  { year = true }: { year?: boolean } = {},
): string | null {
  const day = pgnDate(value);
  return day
    ? day.date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        ...(year ? { year: "numeric" } : {}),
        timeZone: "UTC",
      })
    : null;
}
