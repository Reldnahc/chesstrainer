import type { CoachArtworkProps, CoachExpression } from "../../model";
import { animalPose, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import { AnimalBrows, AnimalEyes, AnimalFrame, AnimalHead } from "./AnimalParts";
import AnimalHands from "./AnimalHands";

const emphasis: Partial<Record<CoachExpression, Partial<AnimalPose>>> = {
  neutral: { eye: 2.7, mouth: "smile" },
  idle: { tilt: -2, eye: 2.3 },
  brilliant: { tilt: -3, lift: -1, eye: 4.6, mouth: "grin", paws: "pair" },
  great: { tilt: 2, eye: 3.5, mouth: "smile" },
  best: { tilt: -1, eye: 2.5, mouth: "ponder", paws: "rest" },
  blunder: { tilt: 2, lift: 1, eye: 5.8, mouth: "oh", paws: "chin" },
  missed: { tilt: -3, eye: 3.6, mouth: "concern" },
  winning: { tilt: -2, lift: -1, closed: true, mouth: "grin", paws: "pair" },
  losing: { tilt: 2, lift: 2, eye: 2.2, mouth: "concern" },
  recovered: { tilt: 2, lift: -1, mouth: "smile", paws: "offer" },
};

function CapybaraMouth({ pose }: { pose: AnimalPose }) {
  return (
    <g transform="translate(5 0)">
      <g className="study-muzzle" stroke="#654c3b" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M56 59v5" />
        {pose.mouth === "smile" && <path d="M40 65q8 5 16-1 8 6 16 0" />}
        {pose.mouth === "ponder" && <path d="M43 67q13 1 25-2" />}
        {pose.mouth === "concern" && <path d="M45 71q11-5 22 0" />}
        {pose.mouth === "grin" && <>
          <path d="M42 64q14 5 27-1-2 13-13 13T42 64Z" fill="#684c3e" />
          <path d="M50 67h11l-1 5h-9Z" fill="#f4e3c4" stroke="none" />
          <path d="M55.5 67v5" stroke="#b7a17d" strokeWidth=".6" />
        </>}
        {pose.mouth === "oh" && <ellipse cx="56" cy="69" rx="5" ry="5.5" fill="#684c3e" />}
      </g>
    </g>
  );
}

export default function CapybaraCoach({ expression }: CoachArtworkProps) {
  const pose: AnimalPose = { ...animalPose(expression, true), ...emphasis[expression] };
  return (
    <AnimalFrame name="capybara" expression={expression} pose={pose} temperament={.48}>
      <path d="M20 118V96q0-23 30-23t30 23v22Z" fill="#a48056" />
      <path d="M34 87q16-6 32 0l4 31H30Z" fill="#c0a076" />
      <path d="M27 112q8-2 15 2m16 0q7-4 15-2" stroke="#755a40" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <AnimalHead>
        <g className="study-ear-motion study-ear-left">
          <path d="M21 35Q14 24 20 20q10-4 16 11Z" fill="#a48056" />
          <path d="M23 30q-5-7-1-7 5-1 9 6Z" fill="#c7a488" />
        </g>
        <g className="study-ear-motion study-ear-right">
          <path d="M65 30q4-13 14-10 7 4 0 15Z" fill="#a48056" />
          <path d="m71 29 6-6q4 1 0 8Z" fill="#c7a488" />
        </g>
        <path d="M20 38q3-15 27-15 27-3 34 15l5 23q2 25-28 25H43Q15 85 16 64Z" fill="#b18e60" />
        <path d="M24 35q4-7 15-8m28 1q8 2 11 9" fill="none" stroke="#d0b481" strokeWidth="2" strokeLinecap="round" />
        <g transform="translate(-3 0)"><AnimalBrows pose={pose} color="#755b3e" weight={2.2} /></g>
        <AnimalEyes pose={pose} xs={[31, 64]} y={42} width={4.6} height={pose.eye} iris="#705537" pupilWidth={2.8} lid="#6e533a" />
        <path d="M33 56q2-11 22-11h20q15 1 16 14v10q-1 14-25 15H52Q31 83 31 68Z" fill="#cbb083" />
        <path d="M49 49q14-4 28 0l2 8q-17 8-32 0Z" fill="#ae8b60" />
        <path d="m53 54 3 1m15 0 3-1" stroke="#604a36" strokeWidth="2.2" strokeLinecap="round" />
        <CapybaraMouth pose={pose} />
        <g className="study-whiskers" stroke="#8c704f" strokeWidth=".9" strokeLinecap="round">
          <path d="m37 62-10-2m11 7-10 1m53-6 9-2m-10 7 10 1" />
        </g>
      </AnimalHead>
      <path d="m29 81 22 7 23-5-5 12-20 3-19-7Z" fill="#668b82" />
      <path d="m54 95 14-3 2 18-11-3Z" fill="#50776e" />
      <path d="m34 87 16 5 17-4" stroke="#a4bab0" strokeWidth="1" fill="none" />
      {pose.paws === "book" && <Book color="#668b82" />}
      <AnimalHands pose={pose} kind="rounded" fur="#a48056" hand="#b99a6d" line="#796042" />
    </AnimalFrame>
  );
}
