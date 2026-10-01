import {authorTacticalWordings} from "../scopedTacticalWording";

export const storytellerTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, there is a {motif} to notice.",
    played_possible: "There is a {motif} to watch for after {move}, if the replies allow it.",
    allowed_immediate: "{opponent} can reply with {action}, with a {motif} to work with.",
    allowed_possible: "Watch for a {motif} that {opponent} could use, if the replies allow it.",
    missed_immediate: "With {best}, there would be a {motif} to work with.",
    missed_possible: "I'd look at {best} for a possible {motif}; the replies still matter.",
  },
  fork: {actual: "The {targets} are attacked together.", possible: "The {targets} would be attacked together."},
  material: "There may be a {gain}, though both sides still have choices to make.",
  capture: {candidate: "{capture} would capture a {piece}.", followup: "One possible follow-up is {capture}, capturing a {piece}."},
  playedCapture: {fact: "The idea to notice with {move} is a {motif}.", consequence: "{capture} captures a {piece}."},
});

export const robotTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "Position after {move}: a {motif} is present.",
    played_possible: "Possible pattern after {move}: a {motif}. The replies determine whether it occurs.",
    allowed_immediate: "Reply available to {opponent}: {action}, with a {motif}.",
    allowed_possible: "Potential resource for {opponent}: a {motif}. Its occurrence depends on the replies.",
    missed_immediate: "Unplayed option: {best}. That would leave a {motif}.",
    missed_possible: "Unplayed option: {best}. A {motif} is possible, depending on the replies.",
  },
  fork: {actual: "Attacked together: the {targets}.", possible: "Potential simultaneous targets: the {targets}."},
  material: "Possible result: a {gain}. Both sides' follow-up choices still matter.",
  capture: {candidate: "Capture available: {capture} would take a {piece}.", followup: "Possible follow-up: {capture}, taking a {piece}."},
  playedCapture: {fact: "Pattern associated with {move}: a {motif}.", consequence: "Capture completed: {capture} takes a {piece}."},
});
