import type { CastHands as HandPose } from "./poses";

const hands: Record<HandPose, readonly [number, number, number, number]> = {
  rest: [27, 110, 73, 110],
  offer: [25, 106, 84, 88],
  lift: [17, 77, 83, 77],
  brace: [20, 63, 80, 63],
  chin: [25, 106, 60, 73],
  resolve: [24, 106, 77, 87],
  balance: [16, 95, 84, 95],
  book: [26, 99, 74, 99],
};

export function CastHands({
  pose,
  skin,
  sleeve,
  joint,
  shoulderSpread = 20,
}: {
  pose: HandPose;
  skin: string;
  sleeve: string;
  joint?: string;
  shoulderSpread?: number;
}) {
  const [lx, ly, rx, ry] = hands[pose];
  return (
    <g className="cast-hands" strokeLinecap="round" strokeLinejoin="round">
      {([false, true] as const).map((right) => {
        const x = right ? rx : lx;
        const y = right ? ry : ly;
        const shoulder = 50 + (right ? shoulderSpread : -shoulderSpread);
        const closed = pose === "resolve" && right;
        const relaxed = pose === "rest" || (!right && ["offer", "chin", "resolve"].includes(pose));
        return (
          <g key={String(right)} className={`study-paw study-paw-${right ? "right" : "left"}`}>
            <path d={`M${shoulder} 87 Q${right ? 84 : 16} 99 ${x} ${y}`} stroke={sleeve} strokeWidth="10" fill="none" />
            {joint && <circle cx={shoulder} cy="87" r="5" fill={joint} />}
            {/* The thumb is authored for screen-right; reflect locally, not at the shoulder. */}
            <g transform={`translate(${x} ${y}) rotate(${right ? 18 : -18}) scale(${right ? 1 : -1} 1)`}>
              {relaxed ? (
                <>
                  <path d="M-5 0q-1-5 4-5h3q4 1 4 5v3q-6 4-11 0Z" fill={skin} />
                  <path d="M-2-2v3m4-3v3" stroke={sleeve} strokeWidth=".8" fill="none" opacity=".55" />
                </>
              ) : closed ? (
                <>
                  <rect x="-5" y="-6" width="10" height="11" rx="4" fill={skin} />
                  <path d="M-1-4v3m3-3v3" stroke={sleeve} strokeWidth="1" fill="none" />
                </>
              ) : (
                <>
                  <path d="M-5 2q-3-2-2-5 1-2 3 0v-6q0-3 2-3t2 3v-2q0-3 2-3t2 3v3q0-3 2-3t2 3v8Q5 7 0 7-3 7-5 2Z" fill={skin} />
                  <path d="M-2-5v4m4-5v5" stroke={sleeve} strokeWidth="0.8" opacity=".55" fill="none" />
                </>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
