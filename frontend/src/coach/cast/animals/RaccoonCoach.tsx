import { useId } from "react";
import type { CoachArtworkProps } from "../../model";
import { animalPose, tailTransform, type AnimalPose } from "../../studies/animalPoses";
import Book from "../../studies/Book";
import { AnimalBrows, AnimalEyes, AnimalFrame, AnimalHead } from "./AnimalParts";
import AnimalHands from "./AnimalHands";

function RaccoonMouth({ pose }: { pose: AnimalPose }) {
  return (
    <g className="study-muzzle" stroke="#5e5650" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M50 57v5" />
      {pose.mouth === "smile" && <path d="M40 64q5 6 10-2 5 8 10 1" />}
      {pose.mouth === "ponder" && <path d="M40 65q10 0 19-4" />}
      {pose.mouth === "concern" && <path d="M41 69q9-7 18 0" />}
      {pose.mouth === "grin" && <>
        <path d="M39 62q11 5 22-1-2 15-11 15T39 62Z" fill="#493b3c" />
        <path d="M46 71q5-4 10 0l-2 4h-6Z" fill="#c58d80" stroke="none" />
      </>}
      {pose.mouth === "oh" && <ellipse cx="50" cy="67" rx="4" ry="6" fill="#493b3c" />}
    </g>
  );
}

export default function RaccoonCoach({ expression }: CoachArtworkProps) {
  const pose = animalPose(expression, false);
  const tailMask = useId();
  return (
    <AnimalFrame name="raccoon" expression={expression} pose={pose} temperament={1.05}>
      <g transform={tailTransform(pose)}>
        <g className="study-tail">
          <defs>
            <clipPath id={tailMask}>
              <path d="M67 102q18 5 16-16l-4-18q-2-10 5-11 8-1 10 13l3 20q2 26-26 26Z" />
            </clipPath>
          </defs>
          <g clipPath={`url(#${tailMask})`}>
            <path d="M67 102q18 5 16-16l-4-18q-2-10 5-11 8-1 10 13l3 20q2 26-26 26Z" fill="#aaa58f" />
            <path d="m75 105 19 7m-10-19 17 2m-20-15 15-3m-18-14 16-3" stroke="#464a4b" strokeWidth="7" />
          </g>
        </g>
      </g>
      <path d="M23 117V95q0-22 27-22t27 22v22Z" fill="#777b77" />
      <path d="M34 83q16 6 32 0l4 34H30Z" fill="#aaa994" />
      <AnimalHead>
        {[false, true].map((right) => (
          <g key={String(right)} transform={right ? "translate(100 0) scale(-1 1)" : undefined}>
            <g transform={`rotate(${right ? -pose.ears[1] : pose.ears[0]} 25 28)`}>
              <g className={`study-ear-motion study-ear-${right ? "right" : "left"}`}>
                <path d="M16 34Q8 15 17 12q12-5 20 17Z" fill="#92948a" />
                <path d="M19 28q-7-13-1-12 8-2 13 12Z" fill="#3c4144" />
                <path d="m21 25-2-6q6 0 8 7Z" fill="#c4b6a6" />
              </g>
            </g>
          </g>
        ))}
        <path d="M21 32Q35 21 50 22q18-1 30 10l9 19-6 1 4 7-11 1Q63 80 50 80 37 80 24 60l-11-1 4-7-6-1Z" fill="#aaa994" />
        <path d="M28 31q10-8 22-7 11-1 22 7L61 48 50 53 39 48Z" fill="#c4c1a9" />
        <path d="M18 42q13-13 29-4l-3 15q-17 5-26-6Zm64 0Q69 29 53 38l3 15q17 5 26-6Z" fill="#323b3f" />
        <path d="M20 53q7 3 14 1m32 0q7 2 14-1" fill="none" stroke="#ded5bd" strokeWidth="2" strokeLinecap="round" />
        <AnimalBrows pose={pose} color="#e7debf" weight={2.4} />
        <AnimalEyes pose={pose} width={5.5} height={pose.eye * .88} iris="#ae8e50" lid="#ede3c9" />
        <path d="M37 53q5-10 13-8 8-2 13 8l3 9q-3 13-16 16-13-3-16-16Z" fill="#e4dcc0" />
        <path d="M43 52q7-4 14 0 1 5-7 8-8-3-7-8Z" fill="#333a3c" />
        <path d="m46 52 4-.5" stroke="#97a09a" strokeWidth="1.2" strokeLinecap="round" />
        <RaccoonMouth pose={pose} />
        <g className="study-whiskers" stroke="#d9d2b7" strokeWidth="1.1" strokeLinecap="round">
          <path d="m31 59-12-1m13 6-11 3m48-9 12-1m-13 7 11 3" />
        </g>
      </AnimalHead>
      <path d="m30 80 20 8 20-8-5 14-15 9-15-9Z" fill="#b48552" />
      <path d="m38 86 12 6 12-6" stroke="#e2c797" strokeWidth="1.2" fill="none" />
      {pose.paws === "book" && <Book color="#8f714d" />}
      <AnimalHands pose={pose} kind="fingers" fur="#777b77" hand="#3d4648" line="#8f9890" />
    </AnimalFrame>
  );
}
