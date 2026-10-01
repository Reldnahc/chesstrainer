import { useLayoutEffect, useRef } from "react";
import type { CoachExpression, CoachMotion } from "../../coach/model";
import CastVoiceAudition from "./CastVoiceAudition";
import StudioTransport from "./StudioTransport";
import { useStudioPlayer } from "./useStudioPlayer";

type Props = {coachId: string; expression?: CoachExpression; motion?: CoachMotion};

export default function CastVoiceAuditionPanel(props: Props) {
  const player = useStudioPlayer();
  const previousCoach = useRef(props.coachId);
  // Cancel the old take before painting the next coach, retaining transport preferences.
  useLayoutEffect(() => {
    if (previousCoach.current === props.coachId) return;
    previousCoach.current = props.coachId;
    player.stop();
  }, [props.coachId, player.stop]);
  return <>
    <StudioTransport player={player} />
    <CastVoiceAudition key={props.coachId} {...props} player={player} />
  </>;
}
