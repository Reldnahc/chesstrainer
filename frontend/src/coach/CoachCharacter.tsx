// The provider-free coach: tools, previews and the picker render it with an explicit
// coach and motion. CoachAvatar wraps it with the learner's saved choice.
import { memo, type ComponentType, type CSSProperties } from "react";
import type { SpeechPlayback } from "../audio/model";
import {
  expressionInfo,
  resolveExpression,
  resolveFamily,
  resolveAnimation,
  supportsSpeech,
  type CoachDefinition,
  type CoachArtworkProps,
  type CoachMotion,
  type CoachMicro,
  type CoachReaction,
} from "./model";
import { usePerformance } from "./usePerformance";
import { useSpeechPerformance } from "./useSpeechPerformance";
import type { SpeechMouthShape, SpeechMouthTrack } from "./speechMouth";
import { CoachFaceProvider } from "./CoachFaceContext";
import type { CoachPerformanceSnapshot } from "./performanceDiagnostics";
import "./coach.css";

// Idle bookkeeping changes the wrapper's channel styles, not the SVG tree.
const CharacterArtwork = memo(function CharacterArtwork({
  Artwork,
  ...props
}: CoachArtworkProps & {
  Artwork: ComponentType<CoachArtworkProps>;
}) {
  return <Artwork {...props} />;
});

export function CoachCharacter({
  coach,
  reaction,
  family,
  motion,
  replay,
  idle = true,
  previewIdle,
  label = "Your chess coach",
  idleSeed,
  idleReset,
  onPerformance,
  speech,
  speechTrack,
  previewSpeechShape,
}: {
  coach: CoachDefinition;
  reaction: CoachReaction;
  family?: string;
  motion: CoachMotion;
  replay?: number;
  idle?: boolean;
  previewIdle?: CoachMicro;
  label?: string;
  idleSeed?: number;
  idleReset?: number;
  onPerformance?: (snapshot: CoachPerformanceSnapshot) => void;
  speech?: SpeechPlayback;
  speechTrack?: SpeechMouthTrack;
  previewSpeechShape?: SpeechMouthShape;
}) {
  const direction = resolveFamily(coach, family);
  const animation = resolveAnimation(coach, direction);
  const requested = resolveExpression(coach, reaction.state);
  // Destructured so the lint rules see the ref apart from the rendered values.
  const {
    ref,
    expression,
    face,
    animated,
    phase,
    micro,
    take,
    motion: performedMotion,
    idles,
    idleStyle: idleTracks,
  } = usePerformance({
    reaction: { ...reaction, state: requested },
    identity: `${coach.id}:${direction}`,
    motion,
    reactionsEnabled: coach.capabilities.reactions,
    replay,
    idleEnabled: idle && coach.capabilities.idle,
    animation,
    previewIdle,
    idleSeed,
    idleReset,
    onPerformance,
  });
  const Artwork = coach.Artwork;
  useSpeechPerformance(
    ref,
    speech,
    animated && supportsSpeech(coach, direction) && speech?.coachId === coach.id,
    `${coach.id}:${direction}`,
    speechTrack,
    supportsSpeech(coach, direction) ? previewSpeechShape : undefined,
  );
  const profile = animation.motionProfile;
  const idleStyle = {
    ...idleTracks,
    "--idle-strength": profile?.amplitude ?? 1,
    "--idle-gaze": profile?.gaze ?? 1,
    "--idle-settle": profile?.settle ?? 1,
  } as CSSProperties;
  return (
    <div
      ref={ref}
      className="coach-avatar"
      role="img"
      aria-label={label}
      data-coach={coach.id}
      data-family={direction}
      data-expression={expression}
      data-requested={requested}
      data-phase={phase}
      data-face={face}
      data-micro={micro}
      data-idles={idles}
      data-motion={performedMotion}
      data-take={take}
      data-motion-profile={profile?.id ?? "default"}
      style={idleStyle}
      title={`${coach.name} · ${expressionInfo[expression].label}`}
    >
      <CoachFaceProvider value={face}>
        <CharacterArtwork Artwork={Artwork} key={take} expression={expression} family={direction} />
      </CoachFaceProvider>
    </div>
  );
}
