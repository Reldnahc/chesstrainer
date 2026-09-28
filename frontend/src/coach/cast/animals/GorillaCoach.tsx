import type { CoachArtworkProps, CoachExpression } from "../../model";
import { animalPose, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import { AnimalBrows, AnimalEyes, AnimalFrame, AnimalHead } from "./AnimalParts";
import AnimalHands from "./AnimalHands";

const emphasis: Partial<Record<CoachExpression, Partial<AnimalPose>>> = {
  brilliant: { tilt: -3, lift: -1, eye: 6, mouth: "grin", paws: "offer" },
  best: { tilt: -1, eye: 3.4, mouth: "ponder", paws: "rest" },
  good: { tilt: 2, closed: true, paws: "rest" },
  blunder: { tilt: 3, lift: 1, eye: 6.8, mouth: "oh", paws: "chin" },
  check: { tilt: 0, lift: 1, eye: 3.6, paws: "pair" },
  winning: { tilt: -3, lift: -1, mouth: "grin", paws: "pair" },
  losing: { tilt: 2, lift: 3, eye: 2.8, paws: "rest" },
  encouraging: { tilt: -2, mouth: "smile", paws: "offer" },
  recovered: { tilt: 3, paws: "pair" },
};

function GorillaMouth({ pose }: { pose: AnimalPose }) {
  return (
    <g className="study-muzzle" stroke="#302f30" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {pose.mouth === "smile" && <path d="M38 65q12 8 24 0" fill="none" />}
      {pose.mouth === "ponder" && <path d="M39 66q11 1 22-2" fill="none" />}
      {pose.mouth === "concern" && <path d="M39 69q11-7 22 0" fill="none" />}
      {pose.mouth === "grin" && <>
        <path d="M35 63q15 6 30 0-3 13-15 13T35 63Z" fill="#382e30" />
        <path d="M38 65q12 3 24 0l-2 4H40Z" fill="#f4e6cd" stroke="none" />
      </>}
      {pose.mouth === "oh" && <ellipse cx="50" cy="69" rx="5.5" ry="7" fill="#382e30" />}
    </g>
  );
}

export default function GorillaCoach({ expression }: CoachArtworkProps) {
  const pose: AnimalPose = { ...animalPose(expression, true), ...emphasis[expression] };
  return (
    <AnimalFrame name="gorilla" expression={expression} pose={pose} temperament={.6}>
      <path d="M8 115V95Q6 74 28 70h44q22 4 20 25v20Z" fill="#383d45" />
      <path d="M27 77q23 11 46 0l6 39H21Z" fill="#565b60" />
      <path d="M31 82q19 7 38 0l-4 27H35Z" fill="#727777" />
      <path d="M13 94q4-12 10-14m64 14q-4-12-10-14" fill="none" stroke="#61666d" strokeWidth="2" strokeLinecap="round" />
      <AnimalHead>
        <g className="study-ear-motion study-ear-left">
          <ellipse cx="22" cy="42" rx="9" ry="11" fill="#383d45" />
          <path d="M23 36q-8 0-5 9l4 2" fill="none" stroke="#888481" strokeWidth="2.6" strokeLinecap="round" />
        </g>
        <g className="study-ear-motion study-ear-right">
          <ellipse cx="78" cy="42" rx="9" ry="11" fill="#383d45" />
          <path d="M77 36q8 0 5 9l-4 2" fill="none" stroke="#888481" strokeWidth="2.6" strokeLinecap="round" />
        </g>
        <path d="M21 46Q18 16 39 12l5-5 6 3 7-2 5 6q20 6 18 32l-1 18Q73 85 50 85 27 85 21 64Z" fill="#383d45" />
        <path d="M29 24q9-10 20-8m11 1q8 2 12 7" fill="none" stroke="#697079" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 37Q24 26 37 26q8 0 13 6 5-6 13-6 13 0 11 11l-2 10Q79 57 72 72 67 82 50 82 33 82 28 72 21 57 28 47Z" fill="#92918a" />
        <path d="M29 48q-5 18 4 24m38-24q5 18-4 24" stroke="#787b78" strokeWidth="2" fill="none" strokeLinecap="round" />
        <AnimalBrows pose={pose} color="#42454a" weight={4.5} />
        <AnimalEyes pose={pose} xs={[35, 65]} y={42} width={5.8} height={pose.eye * .85} iris="#9d8057" lid="#444340" />
        <path d="M39 50q11-6 22 0l4 7q-3 7-15 7t-15-7Z" fill="#545959" />
        <path d="M40 55q4-4 7 0m6 0q3-4 7 0" stroke="#292e32" strokeWidth="3" strokeLinecap="round" fill="none" />
        <GorillaMouth pose={pose} />
      </AnimalHead>
      {pose.paws === "book" && <Book color="#6b8277" />}
      <AnimalHands pose={pose} kind="knuckles" fur="#383d45" hand="#828681" line="#50585a" />
    </AnimalFrame>
  );
}
