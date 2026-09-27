import type { CoachDefinition, CoachExpression, CoachMicro } from "./model";

export function nextIdle(
  animation: CoachDefinition["animation"],
  state: CoachExpression,
  previous: CoachMicro,
  random = Math.random(),
): CoachMicro {
  const available = animation.idleGestures[state] ?? animation.defaultIdle;
  const different = available.filter((gesture) => gesture !== previous);
  const choices = different.length ? different : available;
  return choices[Math.floor(random * choices.length)] ?? "";
}
