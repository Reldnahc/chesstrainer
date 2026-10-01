import { memo, type ComponentType, type CSSProperties } from "react";
import { useCoachPreferences } from "./CoachProvider";
import type { SpeechPlayback } from "../audio/model";
import { getCoach } from "./registry";
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
import { CoachFaceProvider } from "./CoachFaceContext";
import type { CoachPerformanceSnapshot } from "./performanceDiagnostics";
import "./coach.css";

// Idle bookkeeping changes the wrapper's channel styles, not the SVG tree.
const CharacterArtwork = memo(function CharacterArtwork({ Artwork, ...props }: CoachArtworkProps & {
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
}) {
  const direction = resolveFamily(coach, family);
  const animation = resolveAnimation(coach, direction);
  const requested = resolveExpression(coach, reaction.state);
  const performance = usePerformance({
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
  useSpeechPerformance(performance.ref, speech,
    performance.animated && supportsSpeech(coach, direction) && speech?.coachId === coach.id,
    `${coach.id}:${direction}`);
  const profile = animation.motionProfile;
  const idleStyle = {
    ...performance.idleStyle,
    "--idle-strength": profile?.amplitude ?? 1,
    "--idle-gaze": profile?.gaze ?? 1,
    "--idle-settle": profile?.settle ?? 1,
  } as CSSProperties;
  return (
    <div
      ref={performance.ref}
      className="coach-avatar"
      role="img"
      aria-label={label}
      data-coach={coach.id}
      data-family={direction}
      data-expression={performance.expression}
      data-requested={requested}
      data-phase={performance.phase}
      data-face={performance.face}
      data-micro={performance.micro}
      data-idles={performance.idles}
      data-motion={performance.motion}
      data-take={performance.take}
      data-motion-profile={profile?.id ?? "default"}
      style={idleStyle}
      title={`${coach.name} · ${expressionInfo[performance.expression].label}`}
    >
      <CoachFaceProvider value={performance.face}>
        <CharacterArtwork
          Artwork={Artwork}
          key={performance.take}
          expression={performance.expression}
          family={direction}
        />
      </CoachFaceProvider>
    </div>
  );
}

export default function CoachAvatar({ reaction, speech }: { reaction: CoachReaction; speech?: SpeechPlayback }) {
  const { preferences, ready } = useCoachPreferences();
  return (
    <CoachCharacter
      coach={getCoach(preferences.coach_id)}
      reaction={reaction}
      motion={ready ? preferences.motion : "still"}
      speech={speech}
    />
  );
}
