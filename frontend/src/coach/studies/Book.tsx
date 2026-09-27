export default function Book({ color = "#627d78" }: { color?: string }) {
  return (
    <g className="study-book" strokeLinejoin="round">
      <path
        d="M25 87q13-2 25 4 12-6 25-4v25q-13-2-25 3-12-5-25-3Z"
        fill={color}
      />
      <path
        d="M29 84q12 0 21 6 9-6 21-6v24q-12 0-21 5-9-5-21-5Z"
        fill="#f4e9ce"
      />
      <path
        d="M50 91v19m-16-19 11 3m-11 4 11 3m10-7 11-3m-11 10 11-3"
        stroke="#c3ae89"
        strokeWidth="1.2"
        fill="none"
      />
    </g>
  );
}
