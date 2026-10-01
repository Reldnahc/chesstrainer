import type { ReactNode } from 'react';
import { CoachCharacter } from '../../coach/CoachAvatar';
import { getCoach } from '../../coach/registry';
import type { CoachMotion, CoachReaction } from '../../coach/model';
import type { SpeechMouthTrack } from '../../coach/speechMouth';
import type { SpeechPlayback } from '../model';

const walter = getCoach('classic');

/** One voice, two live views. An audition comparison is not a second review bubble. */
export default function WalterMouthComparison({ reaction, motion, speech, track, text, actions }: {
  reaction: CoachReaction; motion: CoachMotion; speech?: SpeechPlayback;
  track: SpeechMouthTrack; text: string; actions: ReactNode;
}) {
  return <section className="walter-mouth-comparison" aria-label="Walter mouth comparison">
    <div className="walter-mouth-pair">
      <figure>
        <CoachCharacter coach={walter} reaction={reaction} motion={motion} speech={speech}
          idle={false} label="Walter, audio-driven mouth" />
        <figcaption><strong>Current</strong><span>Audio-driven mouth</span></figcaption>
      </figure>
      <figure>
        <CoachCharacter coach={walter} reaction={reaction} motion={motion} speech={speech}
          speechTrack={track} idle={false} label="Walter, automatic lip sync" />
        <figcaption><strong>Automatic lip sync</strong><span>Sound-specific mouth shapes</span></figcaption>
      </figure>
    </div>
    <p className="walter-comparison-transcript">{text}</p>
    <div className="walter-comparison-actions">{actions}</div>
    <p className="walter-comparison-note">One recording drives both. Idle gestures are paused for a fair comparison. The automatic timings have not been hand-edited.</p>
  </section>;
}
