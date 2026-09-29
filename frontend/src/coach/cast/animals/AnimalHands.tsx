import type { AnimalPose } from "../../studies/animalPoses";

const positions: Record<AnimalPose["paws"], readonly (readonly [number, number, number])[]> = {
  rest: [[27, 108, -5], [73, 108, 5]],
  offer: [[27, 108, -5], [76, 88, 25]],
  pair: [[35, 89, -18], [65, 89, 18]],
  chin: [[27, 108, -5], [58, 78, -20]],
  cheeks: [[22, 67, -12], [78, 67, 12]],
  celebrate: [[22, 78, -20], [78, 78, 20]],
  book: [[27, 99, -10], [73, 99, 10]],
};

type HandKind = "knuckles" | "fingers" | "webbed" | "rounded";
const outlines: Record<HandKind, string> = {
  knuckles: "M-8 4v-7q0-7 5-7h8q5 0 5 7v7q-8 5-18 0Z",
  fingers: "M-6 4-9-2q-1-3 1-3l3 3-1-9q0-3 2-3 1 0 2 4v-4q0-3 2-3t2 3v2q0-3 2-3t2 3v5q3-3 4-1t-6 12Z",
  webbed: "M-6 5-12-4q-2-3 1-4 2 0 6 5l-1-9q0-3 3-3 2 0 3 9l3-8q2-3 4-1 1 2-3 11l6-2q3 0 3 2L6 6Q0 9-6 5Z",
  rounded: "M-7 4v-6q0-7 7-7t7 7v6q-7 5-14 0Z",
};

export default function AnimalHands({ pose, kind, fur, hand, line }: {
  pose: AnimalPose;
  kind: HandKind;
  fur: string;
  hand: string;
  line: string;
}) {
  return (
    <g className={`cast-hands cast-hands-${kind}`}>
      {positions[pose.paws].map(([x, y, angle], index) => (
        <g key={index} className={`study-paw study-paw-${index ? "right" : "left"}`}>
          <g className={`coach-idle-${index ? "rightPaw" : "leftPaw"}`}>
            <path d={`M${index ? 72 : 28} 86Q${index ? 84 : 16} 102 ${x} ${y + 3}`} fill="none" stroke={fur} strokeWidth={kind === "knuckles" ? 20 : kind === "webbed" ? 8 : 12} strokeLinecap="round" />
            <g transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path d={outlines[kind]} fill={hand} stroke={line} strokeWidth=".65" strokeLinejoin="round" />
              {kind === "knuckles" && <path d="M-4-6v4m5-4v4m4-3v3M-5 3q5 2 10 0" fill="none" stroke={line} strokeWidth="1.2" strokeLinecap="round" />}
              {kind === "rounded" && <path d="M-3 0v3m6-3v3" fill="none" stroke={line} strokeWidth="1" strokeLinecap="round" />}
              {kind === "fingers" && <path d="M-2-6v6m4-6v6" fill="none" stroke={line} strokeWidth=".7" strokeLinecap="round" />}
              {kind === "webbed" && <path d="M-5 0 0 4 5-1" fill="none" stroke={line} strokeWidth=".7" strokeLinecap="round" />}
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}
