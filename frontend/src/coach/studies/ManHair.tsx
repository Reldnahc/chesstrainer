export type ManLook = "host" | "expert" | "partner";

export default function ManHair({ look }: { look: ManLook }) {
  if (look === "host")
    return (
      <g fill="#302a2a">
        <path d="M16 37V23Q13 8 30 8 44 2 58 10q10 4 7 23l-5 5-2-17q-18 8-36 0l-1 17Z" />
        {[
          [20, 17],
          [28, 12],
          [38, 10],
          [48, 11],
          [58, 16],
        ].map(([cx, cy]) => (
          <circle key={cx} cx={cx} cy={cy} r="7" />
        ))}
        <path
          d="M23 15q2-3 5-2m5-3q3-2 5 0m7 0q3-1 5 2m5 4q3 0 4 3"
          fill="none"
          stroke="#57433b"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </g>
    );
  if (look === "expert")
    return (
      <g>
        <path
          d="M16 37Q10 10 33 9q24-7 32 15l-2 14-5-8-1-10Q38 33 23 25l-2 13Z"
          fill="#424247"
        />
        <path
          d="M17 28q0 5 4 10l2-13-4-2Zm43-3-2-5v11l5 7 1-11Z"
          fill="#b1ada2"
        />
        <path
          d="M25 19q11 4 24-4m-19 6q11 0 19-5"
          fill="none"
          stroke="#75747a"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path
          d="M51 13q5 3 8 8"
          fill="none"
          stroke="#b1ada2"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </g>
    );
  return (
    <g fill="#373032">
      <path d="M17 38Q9 32 14 19q-5-9 11-12Q38-2 48 7 67 4 67 22l-5 16-5-8V20Q45 28 33 20q-3 10-10 10l-1 10Z" />
      <path
        d="M21 16q3-7 14-5m3 3q9 4 16-1m-28 8q8-7 13-3"
        fill="none"
        stroke="#68504b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}
