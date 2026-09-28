import { useId } from "react";
import type { CoachArtworkProps } from "../../model";
import Accents from "../../studies/Accents";
import Book from "../../studies/Book";
import { CastHands } from "./CastHands";
import { castPoses, mouthPaths, poseStyle } from "./poses";
import "../../studies/motion.css";
import "./scifi.css";

const eyes = "M22 39Q34 36 44 47q-3 11-12 8-11-3-10-16ZM78 39Q66 36 56 47q3 11 12 8 11-3 10-16Z";

export default function AlienCoach({ expression }: CoachArtworkProps) {
  const pose = castPoses[expression];
  const clip = useId();
  const curious = expression === "thinking" || expression === "uncertain";
  return (
    <svg
      viewBox="0 0 100 125"
      className="coach-artwork study-artwork cast-scifi cast-alien"
      style={poseStyle(pose, 0.7)}
      aria-hidden="true"
      focusable="false"
    >
      <Accents expression={expression} />
      <g className="study-body">
        <g className="study-body-idle">
          <path d="M24 118V98q0-18 18-20h16q18 2 18 20v20Z" fill="#536770" />
          <path d="M42 74h16v16H42Z" fill="#84bba3" />
          <path d="m31 81 19 9 19-9-7 17H38Z" fill="#aa92b4" />
          <path d="m36 83 14 7 14-7" fill="none" stroke="#dcc8d9" strokeWidth="2" />
          <path d="M50 98v20" stroke="#3f535c" strokeWidth="2" />
          <path d="m39 105 4-4 4 4-4 4Z" fill="#b7d8b8" />
          <g className="study-head">
            <g className="study-head-idle">
              <g className="study-head-pose">
                <path d="M18 40 9 34q-2 14 13 20m60-14 9-6q2 14-13 20" fill="#76a992" />
                <path d="M17 36C16 17 30 9 50 9s34 8 33 27C81 59 62 81 50 82 38 81 19 59 17 36Z" fill="#92c9ad" />
                <path d="M25 30Q29 15 48 16" stroke="#c3e3c9" strokeWidth="3" strokeLinecap="round" fill="none" />
                <path d="M24 54q9 15 26 20 17-5 26-20-10 25-26 28-16-3-26-28Z" fill="#7caf98" opacity=".5" />
                <g stroke="#4b7e70" strokeWidth="2" strokeLinecap="round" fill="none">
                  <path d="M26 34q8-3 15 1" transform={`rotate(${pose.brows[0]} 34 34)`} />
                  <path d="M59 35q7-4 15-1" transform={`rotate(${pose.brows[1]} 66 34)`} />
                </g>
                <g transform={`translate(0 ${47 * (1 - pose.eye)}) scale(1 ${pose.eye})`}>
                  <g className="coach-eyes">
                    {pose.closed ? (
                      <path d="M25 47q8-8 17 3m16 0q9-11 17-3" stroke="#283d46" strokeWidth="2.8" strokeLinecap="round" fill="none" />
                    ) : (
                      <>
                        <path d={eyes} fill="#263b47" />
                        <defs><clipPath id={clip}><path d={eyes} /></clipPath></defs>
                        <g clipPath={`url(#${clip})`}>
                          <g className="study-gaze">
                            <g transform={`translate(${pose.gaze.join(" ")})`}>
                              <ellipse cx="35" cy="47" rx="5.5" ry="7" fill="#a9d7c3" />
                              <ellipse cx="65" cy="47" rx="5.5" ry="7" fill="#a9d7c3" />
                              <ellipse cx="35" cy="47" rx={curious ? 2.6 : 3.3} ry="4.8" fill="#304858" />
                              <ellipse cx="65" cy="47" rx={curious ? 2.6 : 3.3} ry="4.8" fill="#304858" />
                              <g className="study-eye-glint" fill="#f3f5d9">
                                <circle cx="33" cy="44" r="1.8" />
                                <circle cx="63" cy="44" r="1.8" />
                              </g>
                            </g>
                          </g>
                        </g>
                      </>
                    )}
                  </g>
                </g>
                <path d="M47 59h1m4 0h1" stroke="#598b78" strokeWidth="1.8" strokeLinecap="round" />
                <path d={mouthPaths[pose.mouth]} fill={pose.mouth === "grin" || pose.mouth === "round" ? "#344c4c" : "none"} stroke="#344c4c" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                {pose.mouth === "grin" && <path d="M43 66q7 2 14 0l-2 3H45Z" fill="#e0eacd" />}
                {expression === "brilliant" && <path d="m17 68 3 3m60 0 3-3" stroke="#a8d7bd" strokeWidth="2" strokeLinecap="round" />}
              </g>
            </g>
          </g>
          {pose.hands === "book" && <Book color="#7a6c96" />}
          <CastHands pose={pose.hands} skin="#92c9ad" sleeve="#536770" />
        </g>
      </g>
    </svg>
  );
}
