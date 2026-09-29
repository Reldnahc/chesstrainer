import type { Gesture } from "./poses";

export default function Arm({
  side,
  hand: [x, y, angle],
  gesture,
  skin = "#f2c5a0",
  shade = "#dba47f",
  sleeve = "#526e66",
  cuff = "#a2b5a9",
}: {
  side: "left" | "right";
  hand: [number, number, number];
  gesture: Gesture;
  skin?: string;
  shade?: string;
  sleeve?: string;
  cuff?: string;
}) {
  const left = side === "left";
  const shoulder = left ? 18 : 62;
  const elbow = left ? 10 : 70;
  const fist = gesture === "fist" || gesture === "win";
  return (
    <g className={`coach-arm coach-arm-${side}`}>
      <g className={`coach-idle-${left ? "leftArm" : "rightArm"}`}>
        <path
          d={`M${shoulder} 78Q${elbow} 92 ${x} ${y + 5}`}
          fill="none"
          stroke={sleeve}
          strokeWidth="10"
          strokeLinecap="round"
        />
        <g transform={`translate(${x} ${y}) rotate(${angle})`}>
          <path d="M-4 5h8v3h-8Z" fill={cuff} />
          <g
            className="coach-hand"
            fill={skin}
            stroke={shade}
            strokeWidth=".65"
            strokeLinejoin="round"
          >
            <path
              d={
                fist
                  ? "M-4 3V-3q0-3 3-3h4q3 0 3 3v6q-4 4-10 0Z"
                  : "M-4 4v-8q0-3 1.8-3 1 0 1 2v-2q0-2 1.5-2T2-7v1q0-2 1.5-2T5-6V0q2-4 3-2t-4 7Z"
              }
            />
            {fist && <path d="M-2-4v3m3-3v3m3-3v3" fill="none" />}
          </g>
        </g>
      </g>
    </g>
  );
}
