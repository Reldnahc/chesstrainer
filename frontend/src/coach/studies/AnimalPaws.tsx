import type { AnimalPose } from "./animalPoses";
import type { AnimalPalette } from "./AnimalFace";

const hands: Record<AnimalPose["paws"], [number, number, number][]> = {
  rest: [
    [30, 107, -8],
    [70, 107, 8],
  ],
  offer: [
    [30, 107, -8],
    [76, 83, 30],
  ],
  pair: [
    [37, 87, -25],
    [63, 87, 25],
  ],
  chin: [
    [30, 107, -8],
    [54, 75, -25],
  ],
  cheeks: [
    [24, 63, -12],
    [76, 63, 12],
  ],
  celebrate: [
    [22, 73, -25],
    [78, 73, 25],
  ],
  book: [
    [28, 99, -15],
    [72, 99, 15],
  ],
};

export default function AnimalPaws({
  pose,
  palette,
  mittens = false,
  positions = hands[pose.paws],
}: {
  pose: AnimalPose;
  palette: AnimalPalette;
  mittens?: boolean;
  positions?: readonly [number, number, number][];
}) {
  return (
    <g>
      {positions.map(([x, y, angle], index) => (
        <g
          className={`study-paw study-paw-${index ? "right" : "left"}`}
          key={index}
        >
          <g className={`coach-idle-${index ? "rightPaw" : "leftPaw"}`}>
            <path
              d={`M${index ? 69 : 31} 88Q${index ? 82 : 18} 101 ${x} ${y + 4}`}
              stroke={palette.fur}
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
            />
            <g transform={`translate(${x} ${y}) rotate(${angle})`}>
              <path
                d="M-7 3v-7q0-5 4-5l3 1 3-1q4 0 4 5v7q-7 6-14 0Z"
                fill={mittens ? palette.muzzle : (palette.paw ?? palette.light)}
              />
              <path
                d="M-3-5v3m6-3v3"
                stroke={palette.dark}
                strokeWidth=".8"
                opacity=".7"
                strokeLinecap="round"
              />
              {pose.paws === "offer" && index === 1 && (
                <ellipse
                  cx="0"
                  cy="0"
                  rx="3.3"
                  ry="2.6"
                  fill={palette.nose}
                  opacity=".5"
                />
              )}
            </g>
          </g>
        </g>
      ))}
    </g>
  );
}
