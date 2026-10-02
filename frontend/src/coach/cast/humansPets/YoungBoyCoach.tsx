import type { CoachArtworkProps } from "../../model";
import YouthCoach, { type YouthLook } from "./YouthCoach";

const look: YouthLook = {
  id: "boy",
  skin: "#d89c71",
  shade: "#b97b55",
  sleeve: "#b88142",
  cuff: "#efd08c",
  hair: "#694133",
  speech: { cavity: "#532e26", lip: "#c2866a", tongue: "#cf8f84" },
  resting: "ready",
  // The biggest, roundest eyes in the cast under thick, high brows.
  face: {
    shape: "round", width: 4.7, height: 1.12, iris: "#6b4426", irisRadius: 2.8,
    sparkle: true, brows: { weight: 3, arch: 1.3, offset: -0.6 }, nose: "button",
  },
  clothing: (
    <>
      <path d="M12 104V86q0-16 20-17h16q20 1 20 17v18Z" fill="#c6914c" />
      <path d="M29 68q11 9 22 0l5 5q-16 21-32 0Z" fill="#8c643d" />
      <path d="m31 73 9 7 9-7-3 31H34Z" fill="#53797a" />
      <path
        d="M33 80v12m14-12v12"
        stroke="#f0d49e"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="m23 94 17 4 17-4v10H23Z" fill="#b68143" />
      <path d="m30 96 10 2 10-2" fill="none" stroke="#d6a964" strokeWidth="1" />
      <path d="M13 101h54v3H13Z" fill="#a9763d" />
    </>
  ),
  frontHair: (
    <g className="study-hair-motion">
      <path
        d="M14 38Q6 25 14 12l-2-6 10 1Q29-3 38 1l9-5-1 7q13-2 19 9l5-1-3 10q5 9-2 18l-4-12q-7-2-10-7-9 13-28 9l-6 13Z"
        fill="#694133"
      />
      <path
        d="M18 18q7-11 20-9M31 19q12-2 18-11M47 22q8 0 12 5"
        fill="none"
        stroke="#946048"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M20 26q17 4 28-12-5 13-21 16Z" fill="#56382e" />
    </g>
  ),
};

export default function YoungBoyCoach({ expression }: CoachArtworkProps) {
  return <YouthCoach expression={expression} look={look} />;
}
