import { useEffect, useRef, useState, type PointerEvent } from "react";
import EvaluationScore from "./EvaluationScore";
import { scoreSide, scoreSummary, scoreText, type Score } from "./evaluation";

type Frame = {
  number: number; actor: "white" | "black" | null; san: string;
  report: { label: string; white_score: Score } | null;
};
type Point = { ply: number; score: Score };
const marked = new Set(["Brilliant", "Great", "Best", "Inaccuracy", "Mistake", "Miss", "Blunder"]);

export default function EvaluationGraph({ frames, initialScore, selected, onSelect, onScrubStart, onScrubSelect, onScrubEnd }: {
  frames: Frame[]; initialScore?: Score | null; selected: number; onSelect: (ply: number) => void;
  onScrubStart?: () => void;
  onScrubSelect?: (ply: number) => void;
  onScrubEnd?: (ply: number) => void;
}) {
  const plot = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: number; ply: number | null } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [width, setWidth] = useState(600);
  const height = 120;
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const resize = () => setWidth(Math.max(80, element.getBoundingClientRect().width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const last = frames.length - 1;
  const reviewed = frames.flatMap((frame, ply) => frame.report ? [{ ply, score: frame.report.white_score }] : []);
  const points: Point[] = initialScore ? [{ ply: 0, score: initialScore }, ...reviewed] : reviewed;
  // Keep one scale for the whole game, independent of the selected move. Mate
  // has no pawn value, so it sits at the edge without inflating the numeric axis.
  const limit = points.reduce((maximum, { score }) => score.kind === "cp"
    ? Math.max(maximum, Math.ceil(Math.abs(score.value) / 100)) : maximum, 4);
  const left = Math.max(38, (String(limit).length + 1) * 7 + 20);
  const right = width - 14, top = 14, bottom = height - 30, middle = (top + bottom) / 2;
  const spacing = (right - left) / Math.max(1, last);
  const radius = Math.min(6, spacing * .35);
  const x = (ply: number) => left + ply * spacing;
  const y = (score: Score) => middle - (score.kind === "mate"
    ? scoreSide(score) === "white" ? 1 : -1
    : score.value / 100 / limit) * (bottom - top) / 2;
  const current = selected === 0 ? initialScore : frames[selected]?.report?.white_score;
  const tabStop = frames[selected]?.report ? selected : reviewed[0]?.ply;
  const segments: Point[][] = [];
  for (const point of points) {
    const previous = segments.at(-1);
    if (previous?.at(-1)?.ply === point.ply - 1) previous.push(point);
    else segments.push([point]);
  }
  const tickPlies = [...new Set([0, ...(width < 400 ? [Math.round(last / 2)] : [1, 2, 3].map(n => Math.round(last * n / 4))), last])];
  const selectPoint = (ply: number, preview = false) => {
    (preview && onScrubSelect ? onScrubSelect : onSelect)(ply);
    plot.current?.querySelector<SVGCircleElement>(`[data-ply="${ply}"]`)?.focus({ preventScroll: true });
  };
  const scrub = (event: PointerEvent<SVGSVGElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientX - bounds.left) * width / bounds.width;
    const ply = Math.max(0, Math.min(last, Math.round((position - left) / spacing)));
    if (drag.current.ply === ply) return;
    drag.current.ply = ply;
    selectPoint(ply, true);
  };
  const stopScrubbing = (event: PointerEvent<SVGSVGElement>, commit = false) => {
    if (drag.current?.id !== event.pointerId) return;
    const ply = drag.current.ply;
    drag.current = null;
    setScrubbing(false);
    if (commit && ply !== null) onScrubEnd?.(ply);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pointName = (ply: number) => `${frames[ply].number}${frames[ply].actor === "white" ? "." : "..."} ${frames[ply].san}`;
  return <section className="game-graph" aria-label="Original-game evaluation">
    <div className="game-graph-heading">
      <div><strong>Game evaluation</strong><span>White ↑ · Black ↓</span></div>
      <div className="game-graph-reading"><span className="game-graph-verdict">{scoreSummary(current)}</span><EvaluationScore score={current}/></div>
    </div>
    <svg ref={plot} className="game-evaluation-plot" data-scrubbing={scrubbing} style={{height}} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="group"
      aria-label="Evaluation across analyzed game moves"
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || drag.current) return;
        // Keep compatibility mouse events from overriding the selected point's focus.
        event.preventDefault();
        // Capture the stable plot, not a marker that moves/reorders as we scrub.
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, ply: null };
        onScrubStart?.();
        setScrubbing(true);
        scrub(event);
      }}
      onPointerMove={scrub}
      onPointerUp={event => { scrub(event); stopScrubbing(event, true); }}
      onPointerCancel={event => stopScrubbing(event)}
      onLostPointerCapture={event => stopScrubbing(event)}>
      <title>Original-game evaluation from White's perspective. Numeric range −{limit} to +{limit} pawns; forced mates sit at the edges. Click or drag to a position to see its exact score.</title>
      <g pointerEvents="none" aria-hidden="true">
        <rect className="game-graph-background" x={left} y={top} width={right - left} height={bottom - top}/>
        {segments.filter(segment => segment.length > 1).map(segment => {
          const line = segment.map(({ ply, score }, i) => `${i ? "L" : "M"}${x(ply)},${y(score)}`).join(" ");
          const start = x(segment[0].ply), end = x(segment.at(-1)!.ply);
          return <g key={segment[0].ply} className="game-graph-segment">
            <path className="game-graph-black" d={`${line} L${end},${top} L${start},${top} Z`}/>
            <path className="game-graph-white" d={`${line} L${end},${bottom} L${start},${bottom} Z`}/>
            <path className="game-graph-line" d={line}/>
          </g>;
        })}
        <line className="game-graph-zero" x1={left} x2={right} y1={middle} y2={middle}/>
        <text className="game-graph-axis" x={left - 16} y={top + 4} textAnchor="end">+{limit}</text>
        <text className="game-graph-axis" x={left - 16} y={middle + 4} textAnchor="end">0</text>
        <text className="game-graph-axis" x={left - 16} y={bottom + 4} textAnchor="end">−{limit}</text>
        {tickPlies.map(ply => <text className="game-graph-tick" key={ply} x={x(ply)} y={height - 4}
          textAnchor={ply === 0 ? "start" : ply === last ? "end" : "middle"}>{ply === 0 ? "Start" : frames[ply].number}</text>)}
        <line className="game-graph-cursor" x1={x(selected)} x2={x(selected)} y1={top - 12} y2={bottom + 12}/>
      </g>
      {[...reviewed.filter(point => point.ply !== selected), ...reviewed.filter(point => point.ply === selected)].map(({ ply, score }) => {
        const label = frames[ply].report!.label;
        return <circle key={ply} className={`game-graph-node label-${label.toLowerCase()}`} data-ply={ply}
          cx={x(ply)} cy={y(score)} r={ply === selected ? 12 : radius}
          data-marked={marked.has(label)} role="button" tabIndex={ply === tabStop ? 0 : -1}
          aria-current={ply === selected ? "step" : undefined}
          aria-label={`${pointName(ply)}, ${label}, evaluation ${scoreText(score)}`}
          onClick={event => {
            // Pointer selection uses the horizontal position, even when a
            // nearby move is underneath the larger selected marker.
            if (event.detail === 0) { event.stopPropagation(); selectPoint(ply); }
          }}
          onKeyDown={event => {
            const index = reviewed.findIndex(point => point.ply === ply);
            const target = event.key === "ArrowLeft" ? reviewed[Math.max(0, index - 1)]
              : event.key === "ArrowRight" ? reviewed[Math.min(reviewed.length - 1, index + 1)]
              : event.key === "Home" ? reviewed[0] : event.key === "End" ? reviewed.at(-1)
              : event.key === "Enter" || event.key === " " ? reviewed[index] : null;
            if (target) { event.preventDefault(); event.stopPropagation(); selectPoint(target.ply); }
          }}><title>{pointName(ply)} · {label} · {scoreText(score)}</title></circle>;
      })}
      {selected === 0 && current && <circle className="game-graph-start" cx={x(0)} cy={y(current)} r={12} pointerEvents="none" aria-hidden="true"/>}
    </svg>
    {!reviewed.length && <p>The timeline fills as your game is reviewed.</p>}
  </section>;
}
