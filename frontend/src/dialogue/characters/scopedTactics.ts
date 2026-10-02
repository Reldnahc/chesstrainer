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

export const capybaraTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, a {motif} is in place. We can take it one piece at a time.",
    played_possible: "After {move}, a {motif} may come later, if the replies allow it. No need to count on it yet.",
    allowed_immediate: "Here is the problem: {opponent} can reply with {action}, and there is a {motif}.",
    allowed_possible: "{opponent} may get a {motif} later, depending on the replies. That is worth keeping in view.",
    missed_immediate: "{best} would have given a {motif}. That is the comparison to make.",
    missed_possible: "{best} offered a possible {motif}, though the replies would still have decided it.",
  },
  fork: {actual: "That attacks the {targets} at the same time.", possible: "The {targets} would be attacked at the same time."},
  material: "There may be a {gain} in it, but both sides still have choices to make first.",
  capture: {candidate: "{capture} would take a {piece}.", followup: "One way it could go on is {capture}, taking a {piece}."},
  playedCapture: {fact: "The idea with {move} is a {motif}.", consequence: "{capture} takes a {piece}."},
});

export const mushroomTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "Something new appears after {move}: a {motif}.",
    played_possible: "After {move}, a {motif} is waiting in the position, if the replies allow it.",
    allowed_immediate: "Something comes loose here: {opponent} can reply with {action}, and there is a {motif}.",
    allowed_possible: "A {motif} could open up for {opponent} later, depending on the replies.",
    missed_immediate: "{best} had a {motif} tucked inside it.",
    missed_possible: "{best} might have held a {motif}, though the replies would still have their say.",
  },
  fork: {actual: "One piece is bothering the {targets} at once.", possible: "The {targets} would be attacked together, by one piece."},
  material: "There may be a {gain} at the end of it, though both sides still have choices to make.",
  capture: {candidate: "{capture} would pick up a {piece}.", followup: "One way it might unfold is {capture}, picking up a {piece}."},
  playedCapture: {fact: "Inside {move} is a {motif}.", consequence: "{capture} picks up a {piece}."},
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

export const slimeTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, a {motif} is right there on the board.",
    played_possible: "After {move}, a {motif} could come along, if the replies allow it.",
    allowed_immediate: "Now {opponent} can answer with {action}, and there's a {motif} in it.",
    allowed_possible: "{opponent} might get a {motif} later on, if the replies go that way.",
    missed_immediate: "{best} would have had a {motif} ready.",
    missed_possible: "{best} could have led to a {motif}, if the replies allowed it.",
  },
  fork: {actual: "That's the {targets} attacked in one go.", possible: "The {targets} would be attacked in one go."},
  material: "There may be a {gain} in it, though both sides still have moves to choose.",
  capture: {candidate: "{capture} would grab a {piece}.", followup: "One way it could go: {capture}, grabbing a {piece}."},
  playedCapture: {fact: "The trick with {move} is a {motif}.", consequence: "{capture} grabs a {piece}."},
});

export const alienTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, a {motif} stands on the board.",
    played_possible: "After {move}, a {motif} becomes possible later, if the replies permit it.",
    allowed_immediate: "{opponent} has an answer in {action}, and it brings a {motif}.",
    allowed_possible: "A {motif} may open for {opponent} later, depending on the replies.",
    missed_immediate: "{best} contained a {motif}.",
    missed_possible: "{best} held the possibility of a {motif}, if the replies had cooperated.",
  },
  fork: {actual: "A single piece now has the {targets} under attack.", possible: "The {targets} would be attacked simultaneously."},
  material: "A {gain} may be the outcome, though each side still has choices first.",
  capture: {candidate: "With {capture}, a {piece} would fall.", followup: "One line of play goes on with {capture}, removing a {piece}."},
  playedCapture: {fact: "{move} contains a {motif}.", consequence: "{capture} removes a {piece}."},
});
