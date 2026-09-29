import { CoachCharacter } from "../CoachAvatar";
import { selectableCoaches } from "../registry";
import { availableIdles } from "../model";

export default function CoachPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="studio-cast" aria-label="Choose a coach to preview">
      {selectableCoaches.map((coach) => (
        <button
          key={coach.id}
          aria-label={`Preview ${coach.name}`}
          aria-pressed={selected === coach.id}
          onClick={() => onSelect(coach.id)}
        >
          <CoachCharacter
            coach={coach}
            reaction={{ state: "neutral", key: "cast" }}
            motion="still"
            idle={false}
            label={`${coach.name} preview`}
          />
          <span>
            <strong>{coach.name}</strong>
            <small>
              {coach.expressions.length} expressions · {availableIdles(coach).length} idle performances
            </small>
          </span>
        </button>
      ))}
    </section>
  );
}
