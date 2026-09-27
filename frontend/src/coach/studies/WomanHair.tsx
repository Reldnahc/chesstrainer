export type WomanLook = "captain" | "analyst" | "spark";

export default function WomanHair({
  look,
  front = false,
}: {
  look: WomanLook;
  front?: boolean;
}) {
  if (look === "analyst")
    return front ? (
      <g fill="#30272b">
        <path d="M16 35Q9 13 24 9q3-11 17-6Q55-2 61 10q13 6 5 27l-6-5Q49 27 46 17 33 33 19 30Z" />
        <path
          d="M20 20q9-9 17-8m9-2q11 2 14 11"
          stroke="#544048"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M17 21Q39 3 63 22"
          stroke="#ba8b83"
          strokeWidth="3"
          fill="none"
        />
      </g>
    ) : (
      <g className="study-hair-motion" fill="#30272b">
        <circle cx="47" cy="6" r="15" />
        <circle cx="32" cy="5" r="13" />
        <circle cx="61" cy="18" r="12" />
        <circle cx="19" cy="22" r="12" />
        <path d="M14 27q-7 21 7 35l2-23m43-13q8 24-8 37l-1-23" />
      </g>
    );
  if (look === "spark")
    return front ? (
      <g fill="#322b3a">
        <path d="M16 35Q9 9 35 7 61 0 65 35l-7-7Q42 32 34 17 31 30 18 34Z" />
        <path
          d="M26 13q14-7 26 4"
          stroke="#675066"
          strokeWidth="2.3"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    ) : (
      <g className="study-hair-motion">
        <path
          d="M53 16q17-13 21 4 5 11-2 22-6 13 3 24-20-4-15-26 3-13-6-16Z"
          fill="#322b3a"
        />
        <path
          d="M62 24q9 8 3 25"
          stroke="#51414f"
          strokeWidth="2"
          fill="none"
        />
        <path d="m59 17 6-3 3 8-7 2Z" fill="#bd8887" />
      </g>
    );
  return front ? (
    <g fill="#714434">
      <path d="M15 37Q8 6 34 6 63-2 65 37l-8-7Q48 28 42 17 35 31 21 31l-3 10Z" />
      <path
        d="M21 20q5-10 18-10M48 11q9 4 12 14"
        stroke="#a96f4c"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  ) : (
    <g className="study-hair-motion" fill="#714434">
      <path d="M16 22Q6 39 12 54l-4 7 8 1-1 7q12 3 18-7h19q10 11 20 1l-5-5q10-12-3-36Z" />
      <path
        d="M15 35q-3 15 7 24m43-23q2 13-6 23"
        stroke="#89563c"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}
