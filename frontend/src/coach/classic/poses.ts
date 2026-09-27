import type { CoachExpression } from "../model";
import { poses, type Pose } from "../human/poses";
export { handPoses } from "../human/poses";

export function familyPose(expression: CoachExpression, family: string): Pose {
  const original = poses[expression];
  if (family === "mentor")
    return {
      ...original,
      tilt: original.tilt * 0.5,
      lift: original.lift * 0.5,
      eye: original.eye * 0.87,
      gesture:
        expression === "brilliant"
          ? "clap"
          : expression === "blunder"
            ? "chin"
            : expression === "winning"
              ? "fist"
              : original.gesture,
      mouth:
        expression === "brilliant"
          ? poses.great.mouth
          : expression === "blunder"
            ? "M35 58 Q40 55 45 58 Q45 63 40 63 Q35 63 35 58Z"
            : original.mouth,
      accent: undefined,
    };
  if (family === "spark")
    return {
      ...original,
      tilt: original.tilt * 1.1,
      eye: original.eye * 0.93,
      gaze: [original.gaze[0] * 1.4, original.gaze[1]],
      closedEyes: expression === "brilliant" ? true : original.closedEyes,
      gesture:
        expression === "brilliant"
          ? "fist"
          : expression === "great"
            ? "present"
            : original.gesture,
    };
  return original;
}
