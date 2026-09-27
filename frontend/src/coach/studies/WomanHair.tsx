export type WomanLook = "captain" | "analyst" | "spark" | "blonde";

export default function WomanHair({
  look,
  front = false,
}: {
  look: WomanLook;
  front?: boolean;
}) {
  if (look === "blonde")
    return front ? (
      <g fill="#dcc078">
        <path d="M16 39Q7 12 28 8 48-2 62 16q7 9 2 24l-6-11-1-10Q45 34 21 31l-1 10Z" />
        <path
          d="M22 23q14-1 29-12M23 27q20-2 32-12"
          stroke="#f4df9f"
          strokeWidth="2.3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M58 20q5 6 3 14"
          stroke="#b99b5d"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    ) : (
      <g className="study-hair-motion">
        <path d="M17 26q-10 19 3 41l9 2 27-2q10-7 9-28l-5-22Z" fill="#b99b5d" />
        <path
          d="M61 44q13 7 4 17 8 6 0 14l-6 4q-11-7-4-15-8-6-1-13Z"
          fill="#dcc078"
        />
        <path
          d="m58 49 8 7-10 7 9 8-6 5"
          stroke="#b29556"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
        />
        <path d="m58 78-2 9 10-2-4-8Z" fill="#e8cc88" />
        <path d="m57 77 7-1 1 4-7 1Z" fill="#9d6774" />
      </g>
    );
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
