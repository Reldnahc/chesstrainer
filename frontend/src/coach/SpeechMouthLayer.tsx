import { useId, type CSSProperties, type ReactNode } from 'react';
import './speech-mouth.css';

/** Keep the authored expression intact outside speech, including Still/hidden playback. */
export function SpeechMouthLayer({ authored, children, className = '' }: {
  authored: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return <g className={`speech-mouth-layer ${className}`}>
    <g className="speech-mouth-authored">{authored}</g>
    <g className="speech-mouth-live">{children}</g>
  </g>;
}

export type SpeechMouthPalette = {
  cavity: string;
  outline: string;
  teeth?: string;
  tongue?: string;
  lip?: string;
};

export type OrganicSpeechMouthProps = {
  /** Mouth center and upper lip in the artwork's own coordinates. */
  x: number;
  y: number;
  /** Full broad aperture dimensions; rounded sounds compensate for this aspect ratio. */
  width: number;
  height: number;
  palette: SpeechMouthPalette;
  mood?: 'smile' | 'neutral' | 'concern';
  teeth?: boolean;
  tongue?: boolean;
  fangs?: boolean;
  /** Custom interior uses x=-10..10, y=0..10 and shares the moving aperture clip. */
  interior?: ReactNode;
};

/** A character owns placement/palette; the playback clock owns the eight speech controls. */
export function OrganicSpeechMouth({
  x, y, width, height, palette, mood = 'neutral', teeth = true, tongue = true,
  fangs = false, interior,
}: OrganicSpeechMouthProps) {
  const mask = useId();
  const curve = mood === 'concern' ? -1 : mood === 'smile' ? 1 : 0;
  const aperture = `M-10 0 C-3.3333 ${curve} 3.3333 ${curve} 10 0 C10.4 6 5.5 10 0 10 C-5.5 10 -10.4 6 -10 0Z`;
  const lip = palette.lip ?? palette.outline;
  const tooth = palette.teeth ?? '#fff3dc';
  const tongueColor = palette.tongue ?? '#bc807d';
  return <g className="organic-speech-mouth" transform={`translate(${x} ${y}) scale(${width / 20} ${height / 10})`}
    fill="none" stroke="none" style={{
      '--organic-speech-contour': `path("${aperture}")`,
      '--organic-speech-aspect': height / width,
    } as CSSProperties}>
    <defs>
      <clipPath id={mask} clipPathUnits="userSpaceOnUse">
        <path className="organic-speech-aperture" d={aperture} />
      </clipPath>
    </defs>
    <g className="organic-speech-closed">
      <path d={`M-10 0 Q0 ${curve * 2.5} 10 0`} stroke={palette.outline}
        className="organic-speech-lip-line" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={`M-5.5 1.8 Q0 ${curve * 2.5 + 2} 5.5 1.8`} stroke={lip}
        className="organic-speech-pressure" strokeWidth=".55" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </g>
    <g className="organic-speech-opening">
      <path className="organic-speech-aperture" d={aperture} fill={palette.cavity} />
      <g clipPath={`url(#${mask})`}>
        {tongue && <>
          <path className="organic-speech-tongue-floor" d="M-6.5 9.5 Q0 6 6.5 9.5L6 12H-6Z" fill={tongueColor} />
          <path className="organic-speech-tongue-tip" d="M-4 8Q-4.8 3-3.2 2Q0-.5 3.2 2Q4.8 3 4 8Z" fill={tongueColor} />
        </>}
        {(teeth || fangs) && <g className="organic-speech-teeth" fill={tooth}>
          {teeth && <path d={`M-11-.35Q0 ${curve - .4} 11-.35L9.5 2.1Q0 3-9.5 2.1Z`} />}
          {fangs && <path d="M-7.8.5-5.2 5.3-3.2.5ZM3.2.5 5.2 5.3 7.8.5Z" />}
        </g>}
        <path className="organic-speech-lip-bite" d="M-11 4Q-7 1-3 2Q0 3 3 2Q7 1 11 4V9H-11Z"
          fill={lip} stroke={palette.outline} strokeWidth=".4" vectorEffect="non-scaling-stroke" />
        {interior}
      </g>
      <path className="organic-speech-aperture" d={aperture} stroke={palette.outline}
        strokeWidth=".65" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </g>
  </g>;
}
