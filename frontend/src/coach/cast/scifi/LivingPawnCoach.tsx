import { ArtworkSvg, BodyRig, HeadRig } from "../../ArtworkRig";
import type { CoachArtworkProps } from "../../model";
import { useEyeClosure } from "../../CoachFaceContext";
import Accents from "../../studies/Accents";
import Book from "../../studies/Book";
import { CastHands } from "./CastHands";
import { castPoses, mouthPaths, poseStyle } from "./poses";
import "../../studies/motion.css";
import "./scifi.css";

export default function LivingPawnCoach({ expression }: CoachArtworkProps) {
  const pose = castPoses[expression];
  const closedEyes = useEyeClosure(pose.closed);
  const bright = expression === "brilliant";
  const startled = expression === "blunder";
  return (
    <ArtworkSvg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork cast-scifi cast-pawn"
      style={poseStyle(pose, 0.95)}
    >
      <Accents expression={expression} />
      <BodyRig>
        <g className="cast-weight">
          <path d="M39 64h22c-3 20 4 31 13 39l-3 8H29l-3-8c9-8 16-19 13-39Z" fill="#ded7ba" />
          <path d="M44 67h8c-3 19-7 28-12 33h-6c9-12 11-21 10-33Z" fill="#f6edd0" />
          <path d="M57 68h4c-2 19 4 31 13 35H62c-5-9-7-24-5-35Z" fill="#bcae8e" />
          <path d="M27 102h46l5 8H22Z" fill="#f0e3c1" />
          <path d="M24 108h52q7 0 7 6v4H17v-4q0-6 7-6Z" fill="#d7c6a0" />
          <path d="M20 112h60" stroke="#f5e8c8" strokeWidth="2" strokeLinecap="round" />
          <path d="M18 118h64" stroke="#9c896b" strokeWidth="3" strokeLinecap="round" />
          <path d="m50 85 4 6-4 6-4-6Z" fill="#9c896b" opacity=".7" />
          <HeadRig>
            <path d="M34 56h32l3 6-4 6H35l-4-6Z" fill="#d4c49e" />
            <path d="M33 59h34" stroke="#f4e7c9" strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="35" r="23" fill="#e9dfbf" />
            <path d="M29 38c3 14 12 21 24 20 9-1 17-7 20-17-4 7-10 11-19 11-12 0-20-6-25-14Z" fill="#ccb995" opacity=".75" />
            <path d="M33 27q4-9 15-10" stroke="#fbf1d8" strokeWidth="3" strokeLinecap="round" fill="none" />
            <g stroke="#807763" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M34 27q5-2 9 0" transform={`rotate(${pose.brows[0]} 39 27)`} />
              <path d="M57 27q4-2 9 0" transform={`rotate(${pose.brows[1]} 61 27)`} />
            </g>
            <g className="coach-eyes" data-eye-state={closedEyes ? "closed" : "open"}>
              {closedEyes ? (
                <path d="M35 35q5-6 10 0m10 0q5-6 10 0" stroke="#3f5359" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              ) : (
                <g className="study-gaze">
                  <g transform={`translate(${pose.gaze.join(" ")})`}>
                    {([40, 60] as const).map((x) => (
                      <g key={x}>
                        {bright ? (
                          <path d={`m${x} 29 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z`} fill="#4d767b" />
                        ) : (
                          <>
                            <ellipse cx={x} cy="35" rx={startled ? 5 : 4.2} ry={5 * pose.eye} fill="#fff8e3" />
                            <ellipse cx={x} cy="35" rx={startled ? 2.1 : 2.6} ry={Math.min(4, 4 * pose.eye)} fill="#3f5359" />
                            <circle cx={x - 0.8} cy="34" r="0.9" fill="#fff9e7" className="study-eye-glint" />
                          </>
                        )}
                      </g>
                    ))}
                  </g>
                </g>
              )}
            </g>
            <g transform="translate(0 -17)">
              <path d={mouthPaths[pose.mouth]} fill={pose.mouth === "grin" || pose.mouth === "round" ? "#665348" : "none"} stroke="#665348" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              {pose.mouth === "grin" && <path d="M43 66q7 2 14 0l-2 3H45Z" fill="#fff8df" />}
            </g>
            {(expression === "encouraging" || expression === "good") && <path d="M33 43h3m28 0h3" stroke="#c79780" strokeWidth="2" strokeLinecap="round" />}
          </HeadRig>
          {pose.hands === "book" && <Book color="#84968a" />}
          <CastHands pose={pose.hands} skin="#e9dfbf" sleeve="#cdbd97" shoulderSpread={14} />
        </g>
      </BodyRig>
    </ArtworkSvg>
  );
}
