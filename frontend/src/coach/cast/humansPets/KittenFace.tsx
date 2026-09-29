import type { AnimalPalette } from "../../studies/AnimalFace";
import type { AnimalPose } from "../../studies/animalPoses";
import { AnimalEyes } from "../animals/AnimalParts";

export default function KittenFace({ pose, palette }: { pose: AnimalPose; palette: AnimalPalette }) {
  return (
    <>
      <g className="study-brows" stroke={palette.brow} strokeWidth="1.5" fill="none" strokeLinecap="round">
        <path d={pose.brows[0]} transform="translate(-4 10)" />
        <path d={pose.brows[1]} transform="translate(4 10)" />
      </g>
      <AnimalEyes pose={pose} xs={[31, 69]} y={55} width={10.5} height={pose.eye}
        pupilWidth={6.2} iris={palette.iris} lid={palette.brow} />
      <g className="study-muzzle" stroke={palette.nose} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M46.5 67q3.5-2 7 0Q53 71 50 71q-3-1-3.5-4Z" fill={palette.nose} stroke="none" />
        <path d="M50 71v3" />
        {pose.mouth === "smile" && <path d="M43 74q3 5 7 0 4 5 7 0" />}
        {pose.mouth === "ponder" && <path d="M45 76q2 2 5-2 2 3 5 1" />}
        {pose.mouth === "concern" && <path d="M44 78q3-3 6-2 3-1 6 2" />}
        {pose.mouth === "oh" && <ellipse cx="50" cy="78" rx="3.2" ry="4" fill="#78545b" stroke="none" />}
        {pose.mouth === "grin" && (
          <>
            <path d="M43 74q7 3 14 0-1 9-7 9t-7-9Z" fill="#78545b" stroke="none" />
            <path d="M46 80q4-2 8 0-4 4-8 0Z" fill="#d6979b" stroke="none" />
          </>
        )}
      </g>
      <g className="study-whiskers" stroke={palette.brow} opacity=".65" strokeWidth=".8" strokeLinecap="round" fill="none">
        <path d="m33 70-13-2m13 6-11 2m45-8 13-2m-13 6 11 2" />
      </g>
    </>
  );
}
