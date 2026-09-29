import type { CoachArtworkProps, CoachExpression } from "../../model";
import { animalPose, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import { AnimalEyes, AnimalFrame, AnimalHead } from "./AnimalParts";
import AnimalHands from "./AnimalHands";

// Broad, open eyes keep Fergus attentive; their height still distinguishes
// relaxed attention from delight or surprise without changing his quiet pose.
const emphasis: Record<CoachExpression, Partial<AnimalPose>> = {
  neutral: { tilt: 0, eye: 6.1, mouth: "ponder" },
  idle: { tilt: -1.5, eye: 5.6, mouth: "ponder" },
  brilliant: { tilt: -2, lift: -1, eye: 8.3, mouth: "smile", paws: "pair" },
  great: { tilt: 1.5, eye: 6.9, mouth: "smile", paws: "offer" },
  best: { tilt: -1, eye: 5.9, mouth: "smile", paws: "rest" },
  good: { tilt: 1, eye: 6, closed: true, mouth: "smile" },
  book: { tilt: 2, eye: 5.8, paws: "book" },
  inaccuracy: { tilt: 3, eye: 6.2, paws: "chin" },
  mistake: { tilt: -2, lift: 1, eye: 6.2, paws: "offer" },
  blunder: { tilt: 0, lift: 1, eye: 9.5, mouth: "oh", paws: "pair" },
  missed: { tilt: -3, eye: 7.1, mouth: "ponder" },
  check: { tilt: 0, eye: 6.4, paws: "offer" },
  winning: { tilt: -1, lift: -1, eye: 6.3, closed: true, mouth: "grin", paws: "rest" },
  losing: { tilt: 1, lift: 2, eye: 5.2, paws: "rest" },
  thinking: { tilt: -2, eye: 6.2, paws: "chin" },
  uncertain: { tilt: 3, eye: 7.5, paws: "pair" },
  encouraging: { tilt: -1, eye: 6.5, mouth: "smile" },
  recovered: { tilt: 1.5, lift: -1, closed: false, eye: 7.4, mouth: "smile", paws: "pair" },
  explaining: { tilt: 1, eye: 6.4, mouth: "ponder" },
  draw: { tilt: -1, eye: 5.8, mouth: "smile" },
};

function FrogMouth({ pose }: { pose: AnimalPose }) {
  return (
    <g className="study-muzzle" stroke="#425d3b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {pose.mouth === "ponder" && <path d="M31 61q19 2 38 0" fill="none" />}
      {pose.mouth === "smile" && <path d="M29 59q21 10 42 0" fill="none" />}
      {pose.mouth === "concern" && <path d="M33 64q17-5 34 0" fill="none" />}
      {pose.mouth === "grin" && <path d="M29 58q21 7 42 0-7 14-21 14T29 58Z" fill="#526345" />}
      {pose.mouth === "oh" && <ellipse cx="50" cy="64" rx="5.5" ry="7" fill="#526345" />}
      <path d="m27 59 2-1m42 0 2 1" fill="none" opacity=".6" />
    </g>
  );
}

export default function FrogCoach({ expression }: CoachArtworkProps) {
  const pose: AnimalPose = { ...animalPose(expression, true), ...emphasis[expression] };
  return (
    <AnimalFrame name="frog" expression={expression} pose={pose} temperament={.38}>
      <path d="M31 91Q16 83 10 96q-6 14 13 20h54q19-6 13-20-6-13-21-5Z" fill="#618859" />
      <path d="M30 92Q22 87 17 96m53-4q8-5 13 4" fill="none" stroke="#87a365" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 98q1-28 26-29t26 29l-5 18H29Z" fill="#83a56a" />
      <path d="M36 84q14-10 28 0l5 29H31Z" fill="#d9d8a0" />
      <path d="m16 112-7 5 12-1 2 4 7-5m54-3 7 5-12-1-2 4-7-5" fill="#83a56a" stroke="#496e46" strokeWidth="1" strokeLinejoin="round" />
      <AnimalHead>
        <path d="M15 40Q12 14 29 14q17 0 19 24h4q2-24 19-24 17 0 14 26l3 9q7 27-38 30T12 49Z" fill="#83a56a" />
        <path d="M19 32q0-13 11-13 10 0 13 14m14 0q3-14 13-14 11 0 11 13" fill="none" stroke="#aac188" strokeWidth="3" strokeLinecap="round" />
        <path className="cast-frog-throat" d="M17 54q33 17 66 0 0 24-33 26-33-2-33-26Z" fill="#d9d8a0" />
        <AnimalEyes pose={pose} xs={[29, 71]} y={35} width={10.6} height={pose.eye} iris="#c3ad58" pupilWidth={4.5} lid="#46623d" />
        <g className="study-brows" transform="translate(0 -7)" stroke="#527648" strokeWidth="2" fill="none" strokeLinecap="round">
          <path d={pose.brows[0]} transform="translate(-6 0)" />
          <path d={pose.brows[1]} transform="translate(6 0)" />
        </g>
        <g fill="#517348">
          <ellipse cx="44" cy="51" rx="1.2" ry=".9" />
          <ellipse cx="56" cy="51" rx="1.2" ry=".9" />
        </g>
        <FrogMouth pose={pose} />
        <g fill="#618651" opacity=".75">
          <circle cx="18" cy="47" r="1.5" /><circle cx="23" cy="50" r="1" />
          <circle cx="82" cy="47" r="1.5" /><circle cx="77" cy="50" r="1" />
        </g>
      </AnimalHead>
      {pose.paws === "book" && <Book color="#667c57" />}
      <AnimalHands pose={pose} kind="webbed" fur="#83a56a" hand="#a7bc7e" line="#54774b" />
    </AnimalFrame>
  );
}
