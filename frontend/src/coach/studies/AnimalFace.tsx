import { useId } from "react";
import type { AnimalPose } from "./animalPoses";

export type AnimalPalette = {
  fur: string;
  dark: string;
  light: string;
  muzzle: string;
  nose: string;
  iris: string;
  accent: string;
  brow: string;
  lid?: string;
  paw?: string;
  lip?: string;
};

export default function AnimalFace({
  pose,
  palette,
  dog = false,
  muzzleShape,
}: {
  pose: AnimalPose;
  palette: AnimalPalette;
  dog?: boolean;
  muzzleShape?: string;
}) {
  const mask = useId();
  const { eye, gaze } = pose;
  const xs = dog ? [36, 64] : [35, 65];
  const eyeWidth = dog ? 5.5 : 6.5;
  const noseY = dog ? 56 : 54;
  return (
    <>
      <g
        className="study-brows"
        stroke={palette.brow}
        strokeWidth={dog ? 2.6 : 1.8}
        fill="none"
        strokeLinecap="round"
      >
        <path d={pose.brows[0]} />
        <path d={pose.brows[1]} />
      </g>
      <g className="animal-eyes">
        {pose.closed ? (
          <g
            stroke={palette.lid ?? "#302b29"}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          >
            {xs.map((x) => (
              <path
                key={x}
                d={`M${x - 5} 44q5 ${pose.mouth === "concern" ? 5 : -7} 10 0`}
              />
            ))}
          </g>
        ) : (
          <>
            <defs>
              <clipPath id={mask}>
                {xs.map((x) => (
                  <ellipse key={x} cx={x} cy="43" rx={eyeWidth} ry={eye} />
                ))}
              </clipPath>
            </defs>
            {xs.map((x) => (
              <ellipse
                key={x}
                cx={x}
                cy="43"
                rx={eyeWidth}
                ry={eye}
                fill="#fff5de"
              />
            ))}
            <g clipPath={`url(#${mask})`}>
              <g className="study-gaze">
                <g transform={`translate(${gaze.join(" ")})`}>
                  {xs.map((x) => (
                    <g key={x}>
                      <ellipse
                        cx={x}
                        cy="43"
                        rx={dog ? 4.6 : 4.9}
                        ry={eye}
                        fill={palette.iris}
                      />
                      <ellipse
                        cx={x}
                        cy="43"
                        rx={dog ? 2.8 : 1.8}
                        ry={Math.max(2.7, eye - 0.3)}
                        fill="#282d2b"
                      />
                      <circle
                        className="study-eye-glint"
                        cx={x - 1.3}
                        cy="41.2"
                        r="1.2"
                        fill="#fff9ed"
                      />
                    </g>
                  ))}
                </g>
              </g>
            </g>
            <path
              d={`M${xs[0] - eyeWidth} 41q${eyeWidth} ${-eye - 1} ${eyeWidth * 2} 0m${xs[1] - xs[0] - eyeWidth * 2} 0q${eyeWidth} ${-eye - 1} ${eyeWidth * 2} 0`}
              fill="none"
              stroke={palette.brow}
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </>
        )}
      </g>
      {dog ? (
        <path
          d={
            muzzleShape ??
            "M32 57q0-10 11-10h14q11 0 11 10v5Q65 77 50 77 35 77 32 62Z"
          }
          fill={palette.muzzle}
        />
      ) : (
        <path
          d="M35 54q1-8 15-4 14-4 15 4 2 13-15 15-17-2-15-15Z"
          fill={palette.muzzle}
        />
      )}
      <g
        className="study-muzzle"
        fill="none"
        stroke={palette.nose}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dog ? (
          <path d="M42 52q8-3 16 0 1 7-8 10-9-3-8-10Z" fill={palette.nose} />
        ) : (
          <path d="M46 51q4-2 8 0l-4 5Z" fill={palette.nose} />
        )}
        {dog && <path d="m46 53 5-.4" stroke="#a5917f" strokeWidth="1.2" />}
        <path d={`M50 ${noseY + 2}v4`} />
        {pose.mouth === "smile" && (
          <path
            d={`M${dog ? 39 : 41} ${noseY + 7}q5 5 ${dog ? 11 : 9} -1 5 6 ${dog ? 11 : 9} 1`}
          />
        )}
        {pose.mouth === "grin" && (
          <>
            <path
              d={`M${dog ? 38 : 40} ${noseY + 7}q${dog ? 12 : 10} 5 ${dog ? 24 : 20} 0-1 13-${dog ? 12 : 10} 13-${dog ? 11 : 9}-1-${dog ? 12 : 10}-13Z`}
              fill="#5b3630"
              stroke={palette.lip ?? "none"}
            />
            <path
              d={`M45 ${noseY + 14}q5-4 10 0v4q-5 7-10 0Z`}
              fill="#dc8e89"
              stroke="none"
            />
            <path d={`M50 ${noseY + 16}v3`} stroke="#b76d6d" strokeWidth=".6" />
          </>
        )}
        {pose.mouth === "oh" && (
          <ellipse
            cx="50"
            cy={noseY + 11}
            rx={dog ? 4.5 : 3.8}
            ry="5.5"
            fill="#5b3630"
            stroke={palette.lip ?? "none"}
          />
        )}
        {pose.mouth === "concern" && <path d={`M42 ${noseY + 12}q8-5 16 0`} />}
        {pose.mouth === "ponder" && <path d={`M44 ${noseY + 9}q5 2 11-2`} />}
      </g>
      {!dog && (
        <g
          className="study-whiskers"
          stroke={palette.light}
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        >
          <path d="m34 55-15-3m15 7-15 2m47-6 15-3m-15 7 15 2" />
          <g fill={palette.nose} stroke="none" opacity=".55">
            <circle cx="40" cy="55" r=".7" />
            <circle cx="60" cy="55" r=".7" />
          </g>
        </g>
      )}
    </>
  );
}
