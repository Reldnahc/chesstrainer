import type { CoachArtworkProps } from "../../model";
import YouthCoach, { type YouthLook } from "./YouthCoach";

const look: YouthLook = {
  id: "girl",
  skin: "#ae7658",
  shade: "#8f573f",
  sleeve: "#c6baa4",
  cuff: "#e4d8bc",
  hair: "#352e34",
  speech: { cavity: "#532e26", lip: "#a26a52", tongue: "#c27f78" },
  resting: "hips",
  // Sharp, slightly upturned eyes and one raised brow: she has spotted something.
  face: {
    shape: "upturned", width: 4.3, height: 0.95, iris: "#3c2618", irisRadius: 2.5,
    liner: "line", sparkle: true, brows: { weight: 2.4, arch: 0.9, raise: 2.2 }, nose: "button",
  },
  clothing: (
    <>
      <path d="M12 104V87q0-17 20-18h16q20 1 20 18v17Z" fill="#d2c6ad" />
      <path d="M24 73h8v13h16V73h8v31H24Z" fill="#65789f" />
      <path d="M25 86h30v18H25Z" fill="#7188b1" />
      <path d="M33 91h14v10H33Z" fill="#526989" />
      <path d="M34 92h12" stroke="#a5b9d1" strokeWidth="1" />
      <circle cx="29" cy="85" r="1.7" fill="#ddbc70" />
      <circle cx="51" cy="85" r="1.7" fill="#ddbc70" />
      <path d="M15 99h8m34 0h8" stroke="#b0a58f" strokeWidth="1.2" />
    </>
  ),
  backHair: (
    <g className="study-hair-motion">
      <path d="M16 12Q3 4 1 16q-7 6 1 14-1 11 12 10l8-15Z" fill="#352e34" />
      <path d="M64 12Q77 4 79 16q7 6-1 14 1 11-12 10l-8-15Z" fill="#352e34" />
      <path
        d="M6 16q1-6 6-4m-7 13q-3 6 3 7m66-16q-1-6-6-4m7 13q3 6-3 7"
        fill="none"
        stroke="#51414a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="m14 17 7 8m45-8-7 8"
        stroke="#ce865e"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </g>
  ),
  frontHair: (
    <g className="study-hair-motion">
      <path
        d="M14 36Q8 16 21 7q17-12 33-2 16 7 12 31l-6-15q-13 0-20-10-7 13-22 14Z"
        fill="#352e34"
      />
      <path
        d="M20 17q11-3 18-12m7 1q8 9 16 11"
        stroke="#51414a"
        strokeWidth="1.7"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M19 25q-3 7-1 12M61 25q3 7 1 12"
        stroke="#352e34"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="m52 19 5 3"
        stroke="#e1b363"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  ),
};

export default function YoungGirlCoach({ expression }: CoachArtworkProps) {
  return <YouthCoach expression={expression} look={look} />;
}
