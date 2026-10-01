import type { ReactNode } from 'react';
import { CoachCharacter } from '../../coach/CoachAvatar';
import { getCoach } from '../../coach/registry';
import type { CoachMotion, CoachReaction } from '../../coach/model';
import type { SpeechMouthTrack } from '../../coach/speechMouth';
import type { SpeechPlayback } from '../model';

const walter = getCoach('classic');

/** One voice, two live views. An audition comparison is not a second review bubble. */
export default function WalterMouthComparison({ reaction, motion, speech, track, originalTrack, text, actions }: {
  reaction: CoachReaction; motion: CoachMotion; speech?: SpeechPlayback;
  track: SpeechMouthTrack; originalTrack: SpeechMouthTrack; text: string; actions: ReactNode;
}) {
  return <section className="walter-mouth-comparison" aria-label="Walter mouth comparison">
    <div className="walter-mouth-pair">
      <figure>
        <CoachCharacter coach={walter} reaction={reaction} motion={motion} speech={speech}
          speechTrack={originalTrack} idle={false} label="Walter, original generator" />
        <figcaption><strong>First generator</strong><span>Original Rhubarb timing</span></figcaption>
      </figure>
      <figure>
        <CoachCharacter coach={walter} reaction={reaction} motion={motion} speech={speech}
          speechTrack={track} idle={false} label="Walter, automatic lip sync" />
        <figcaption><strong>Revised generator</strong><span>Aligned to the script</span></figcaption>
      </figure>
    </div>
    <p className="walter-comparison-transcript">{text}</p>
    <div className="walter-comparison-actions">{actions}</div>
    <p className="walter-comparison-note">Same voice, artwork and playback. Only the generated mouth cues differ. No hand-edited timing; idle gestures are paused for comparison.</p>
  </section>;
}
