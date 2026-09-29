import type { CoachArtworkProps } from "../../model";
import { animalPose, type AnimalPose } from "../../studies/animalPoses";
import FantasyFace from "./FantasyFace";
import FantasyShell, { FantasyHead } from "./FantasyShell";

function UnicornMouth({ mouth }: { mouth: AnimalPose["mouth"] }) {
  // Equine expressions sit low on the muzzle, with a quiet lip seam rather
  // than the shared face's toothy smile. Eyes, ears and posture carry the joy.
  const seams: Record<Exclude<AnimalPose["mouth"], "oh">, string> = {
    smile: "M43 69q7 2.5 14 0",
    grin: "M42 67.5q8 5 16 0",
    ponder: "M44 69q6 1 12-.5",
    concern: "M44 70q6-2 12 0",
  };
  return mouth === "oh" ? (
    <path
      d="M46.5 69Q50 67.5 53.5 69Q50 72.5 46.5 69Z"
      fill="currentColor"
      strokeWidth="1"
    />
  ) : (
    <path d={seams[mouth]} strokeWidth="1.4" />
  );
}

function Hooves({ pose }: { pose: AnimalPose }) {
  const lifted =
    pose.paws === "cheeks" || pose.paws === "celebrate" || pose.paws === "pair";
  const rightY =
    pose.paws === "chin" ? 77 : pose.paws === "offer" ? 84 : lifted ? 73 : 109;
  const leftY = lifted ? 73 : 109;
  return (
    <g fill="none" strokeLinecap="round">
      {[
        [29, leftY, "left"],
        [71, rightY, "right"],
      ].map(([x, y, side]) => (
        <g
          key={side}
          className={`study-paw fantasy-hoof-${side} ${side === "right" ? "study-paw-right" : "study-paw-left"}`}
        >
          <path
            d={`M${x} 91Q${side === "left" ? 17 : 83} 96 ${x} ${y}`}
            stroke="#e2dbdf"
            strokeWidth="11"
          />
          <path
            d={`M${Number(x) - 5} ${Number(y) - 5}h10v8q-5 3-10 0Z`}
            fill="#928294"
            stroke="#766977"
            strokeWidth=".8"
          />
        </g>
      ))}
    </g>
  );
}

export default function UnicornCoach({ expression }: CoachArtworkProps) {
  const pose = animalPose(expression, false);
  return (
    <FantasyShell
      expression={expression}
      pose={{ ...pose, tilt: pose.tilt * 0.7 }}
      character="unicorn"
      temperament={0.85}
    >
      <path d="M27 118V98q-2-18 10-23h27q13 10 11 26v17Z" fill="#d6cdd7" />
      <path d="M37 77h23q-2 23 7 41H35q8-22 2-41Z" fill="#f0e5e1" />
      <FantasyHead>
        <g className="study-hair-motion fantasy-mane">
          <path
            d="M62 24q29-1 24 35-3 20 7 29-1 13-9 15 9 8 3 18-20-1-24-12 11-5 7-15-12-18-5-34Z"
            fill="#9c86b2"
          />
          <path
            d="M75 29q12 22 0 42 0 14 10 20-11 12-6 23"
            fill="none"
            stroke="#ccb7d9"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M80 46q1 14-8 25"
            fill="none"
            stroke="#87bdb9"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </g>
        {[false, true].map((right) => (
          <g
            key={String(right)}
            transform={right ? "translate(100 0) scale(-1 1)" : undefined}
          >
            <g
              transform={`rotate(${right ? -pose.ears[1] : pose.ears[0]} 28 33)`}
            >
              <g
                className={`study-ear-motion study-ear-${right ? "right" : "left"}`}
              >
                <path d="M23 35Q13 25 19 10q14 6 15 23Z" fill="#e6dfe4" />
                <path d="M24 29q-6-8-3-12 7 5 8 13Z" fill="#bc9fb9" />
              </g>
            </g>
          </g>
        ))}
        <path
          d="M27 36q3-15 23-15t23 15l-4 18q8 13 0 23-7 8-19 8-15 0-21-9-6-9 1-20Z"
          fill="#ece5e7"
          stroke="#c7bdcc"
          strokeWidth="1.2"
        />
        <path
          d="M46 30 52 4l7 28Z"
          fill="#e5c781"
          stroke="#b8a16b"
          strokeWidth="1"
        />
        <path d="m49 18 6 3m-8 6 10 3" stroke="#b79b6e" strokeWidth="1.1" />
        <g className="study-hair-motion">
          <path d="M26 32q6-20 26-14-4 9-14 16l-5 9-5-4 4-9Z" fill="#b399c9" />
          <path d="M55 21q13 0 20 12l-6 12q-1-13-14-24Z" fill="#9b83b1" />
          <path
            d="M32 29q7-6 13-7"
            fill="none"
            stroke="#d5c2df"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
        <FantasyFace
          pose={pose}
          ink="#5c4c65"
          iris="#83a9a8"
          mouthColor="#9b808e"
          kind="bright"
          mouth={
            <g color="#9b808e">
              <UnicornMouth mouth={pose.mouth} />
            </g>
          }
          muzzle={
            <>
              <path
                d="M33 56q17-7 34 0 8 8 2 16-19 12-38 0-6-8 2-16Z"
                fill="#e0d1d9"
              />
              <ellipse
                cx="39"
                cy="60"
                rx="1.8"
                ry="1.2"
                transform="rotate(25 39 60)"
                fill="#ad929f"
              />
              <ellipse
                cx="61"
                cy="60"
                rx="1.8"
                ry="1.2"
                transform="rotate(-25 61 60)"
                fill="#ad929f"
              />
            </>
          }
        />
      </FantasyHead>
      <path d="m34 85 16 8 16-8-3 10-13 7-13-7Z" fill="#799d9a" />
      <path d="m50 93 4 4-4 5-4-5Z" fill="#e7cc8a" />
      {expression === "book" && (
        <g>
          <path d="m28 96 22 3 22-3v17l-22 3-22-3Z" fill="#8b729f" />
          <path d="m31 96 19 3 19-3v13l-19 3-19-3Z" fill="#eee1c3" />
          <path d="M50 99v13" stroke="#bfadbd" />
        </g>
      )}
      <Hooves pose={pose} />
    </FantasyShell>
  );
}
