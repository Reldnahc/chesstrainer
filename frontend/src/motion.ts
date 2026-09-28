import type { Schema } from "./api";

export type MotionPreference = NonNullable<Schema["MotionPreferences"]["motion"]>;

export function resolveMotion(preference: MotionPreference, deviceReduced: boolean) {
  return preference === "system" ? (deviceReduced ? "still" : "natural") : preference;
}
