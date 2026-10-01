import Button from "../../Button";
import Notice from "../../Notice";
import { castAuditionCoaches } from "../speech/castAuditions";
import { castingChoiceLabel } from "./CastingChoice";
import type { CastingChoices } from "./useCastingChoices";

export default function CastingProgress({choices, onCoach}: {choices: CastingChoices; onCoach?: (id: string) => void}) {
  const locked = castAuditionCoaches.filter(item => choices.locks[item.coachId]).length;
  const staleLocks = castAuditionCoaches.filter(item => choices.locks[item.coachId]?.stale);
  const current = castAuditionCoaches.flatMap(item => !choices.locks[item.coachId] && choices.choices[item.coachId] ? [choices.choices[item.coachId]] : []);
  const selected = current.filter(choice => !choice.stale && choice.status === "selected").length;
  const looking = current.filter(choice => !choice.stale && choice.status === "keep-looking").length;
  const remaining = castAuditionCoaches.length - locked - selected - looking;
  const progress = locked ? `${locked} locked · ${selected ? `${selected} chosen · ` : ""}${castAuditionCoaches.length - locked - selected} need a voice${staleLocks.length ? ` · ${staleLocks.length} need review` : ""}` :
    `${selected} chosen · ${looking} keep looking · ${remaining} to decide`;
  return <div className="casting-progress">
    {choices.loadError ? <Notice tone="error" announcement="alert" appearance="inline"
      actions={<Button size="compact" onClick={() => void choices.reload()}>Retry loading choices</Button>}>
      {choices.loadError}
    </Notice> : <>
      <p className="casting-progress-count" role="status">{choices.ready ?
        progress : "Loading saved choices…"}</p>
      {choices.ready && staleLocks.length > 0 && <Notice tone="error" appearance="inline" announcement="status"
        actions={onCoach && <Button size="compact" onClick={() => onCoach(staleLocks[0].coachId)}>Inspect locked recording</Button>}>
        A locked audition has changed or is unavailable. The saved voice remains locked.
      </Notice>}
      <details className="disclosure">
        <summary>All casting choices</summary>
        <ul>
          {castAuditionCoaches.map(item => <li key={item.coachId}>
            <strong>{item.coach.name}</strong>
            <span>{choices.ready ? choices.locks[item.coachId] ? `Locked: ${choices.locks[item.coachId].label}${choices.locks[item.coachId].stale ? " — needs review" : ""}` :
              castingChoiceLabel(choices.choices[item.coachId], item.directions) : "Loading…"}</span>
            {onCoach && <Button size="compact" variant="quiet" onClick={() => onCoach(item.coachId)} aria-label={`Audition ${item.coach.name}`}>Listen</Button>}
          </li>)}
        </ul>
      </details>
    </>}
    <p className="cast-audition-note">Choices are saved on this studio’s computer and shared with your other devices. They do not change the application’s voices.</p>
  </div>;
}
