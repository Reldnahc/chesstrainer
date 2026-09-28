import type { CSSProperties } from "react";
import { useCoachPreferences } from "./CoachProvider";
import { getCoach } from "./registry";
import {
  expressionInfo,
  resolveExpression,
  resolveFamily,
  resolveAnimation,
  type CoachDefinition,
  type CoachMotion,
  type CoachMicro,
  type CoachReaction,
} from "./model";
import { usePerformance } from "./usePerformance";
import "./coach.css";

export function CoachCharacter({
  coach,
  reaction,
  family,
  motion,
  replay,
  idle = true,
  previewIdle,
  label = "Your chess coach",
}: {
  coach: CoachDefinition;
  reaction: CoachReaction;
  family?: string;
  motion: CoachMotion;
  replay?: number;
  idle?: boolean;
  previewIdle?: CoachMicro;
  label?: string;
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
  });
  const Artwork = coach.Artwork;
  const profile = animation.motionProfile;
  const idleStyle = {
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
      data-micro={performance.micro}
      data-motion={performance.motion}
      data-take={performance.take}
      data-motion-profile={profile?.id ?? "default"}
      style={idleStyle}
      title={`${coach.name} · ${expressionInfo[performance.expression].label}`}
    >
      <Artwork
        key={performance.take}
        expression={performance.expression}
        family={direction}
      />
    </div>
  );
}

export default function CoachAvatar({ reaction }: { reaction: CoachReaction }) {
  const { preferences, ready } = useCoachPreferences();
  return (
    <CoachCharacter
      coach={getCoach(preferences.coach_id)}
      reaction={reaction}
      motion={ready ? preferences.motion : "still"}
    />
  );
}
