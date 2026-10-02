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

export const livingPawnTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} puts a piece to work, and there's a {motif} on the board.",
    played_possible: "After {move}, a {motif} may get its chance, depending on how the replies go.",
    allowed_immediate: "{opponent} can answer with {action}, and a {motif} goes to work.",
    allowed_possible: "{opponent} could find a use for a {motif} later on; the replies decide whether it happens.",
    missed_immediate: "{best} had a {motif} ready to go.",
    missed_possible: "{best} might have set up a {motif}; whether it lands depends on the replies.",
  },
  fork: {actual: "One piece now hits the {targets} all at once.", possible: "The {targets} would be attacked, and by a single hardworking piece."},
  material: "A {gain} may be in the cards, but both sides still have moves to make.",
  capture: {candidate: "{capture} would snap up a {piece}.", followup: "If play goes that way, {capture} could follow and take a {piece} off the board."},
  playedCapture: {fact: "{move} goes to work with a {motif}.", consequence: "{capture} takes a {piece} off the board."},
});

export const professorTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} is played for a {motif}, which is in place as soon as the move is made.",
    played_possible: "{move} prepares a possible {motif}, though whether it arrives is up to the replies.",
    allowed_immediate: "{opponent} has {action} as an answer, and the reason that matters is a {motif}.",
    allowed_possible: "{opponent} may later be able to use a {motif}, if the replies in between allow it.",
    missed_immediate: "{best} would have brought a {motif} straight away, which is why it's the move to compare.",
    missed_possible: "{best} could have prepared a {motif}, though it would still have depended on the replies.",
  },
  fork: {actual: "One piece attacks the {targets} together, so a single reply may not save them all.", possible: "In that case the {targets} would be attacked together, and one reply might not cover them all."},
  material: "A {gain} may be possible at the end of it, but only if the later choices on both sides allow it.",
  capture: {candidate: "That opens the way for {capture}, which would capture a {piece}.", followup: "If play continues that way, {capture} may follow, capturing a {piece}."},
  playedCapture: {fact: "{move} rests on a {motif}.", consequence: "That is how {capture} comes to capture a {piece}."},
});

export const collieTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} sets a {motif} on the board right now.",
    played_possible: "{move} lines up a {motif} that may come, subject to the replies.",
    allowed_immediate: "{opponent} gets {action}, and with it a {motif}.",
    allowed_possible: "{opponent} may set up a {motif} later, replies permitting.",
    missed_immediate: "{best} would have put a {motif} on the board at once.",
    missed_possible: "{best} could have set the stage for a {motif}, depending on the answers.",
  },
  fork: {actual: "The {targets} are now under attack together from one piece.", possible: "The {targets} would be attacked by one piece in a single move."},
  material: "A {gain} may be on offer, but only if both sides play it out that way.",
  capture: {candidate: "{capture} could then snap off a {piece}.", followup: "Next in line could be {capture}, taking a {piece}."},
  playedCapture: {fact: "{move} sets off a {motif}.", consequence: "{capture} nets a {piece}."},
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

export const wizardTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "With {move}, a familiar pattern takes its place on the board: a {motif}.",
    played_possible: "{move} prepares a {motif}, though the replies will decide whether the pattern completes.",
    allowed_immediate: "{opponent} can answer with {action}, and the pattern waiting there is a {motif}.",
    allowed_possible: "A {motif} may later become available to {opponent}; whether the pattern forms depends on the replies.",
    missed_immediate: "The pattern lay in {best}: a {motif}.",
    missed_possible: "{best} might have led to a {motif}, had the replies allowed the pattern to form.",
  },
  fork: {actual: "The {targets} fall under a single attacker, the fork in its plainest form.", possible: "From one square, the {targets} would be attacked at once."},
  material: "A {gain} may be waiting where the pattern ends, though both sides still have moves to choose.",
  capture: {candidate: "{capture} would take a {piece} from the board.", followup: "Should play continue that way, {capture} may follow, collecting a {piece}."},
  playedCapture: {fact: "The pattern behind {move} is a {motif}.", consequence: "{capture} lifts a {piece} from the board."},
});

export const tuxedoTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "A {motif}, on the board as soon as {move} lands.",
    played_possible: "{move} may lead to a {motif}. The replies get a vote first.",
    allowed_immediate: "{action} is available to {opponent}, and a {motif} is ready to use.",
    allowed_possible: "A {motif} may open up for {opponent} later, replies permitting.",
    missed_immediate: "{best} came with a {motif}. This move leaves it lying there.",
    missed_possible: "{best} might have produced a {motif}, had the replies cooperated.",
  },
  fork: {actual: "One piece now has the {targets} under fire.", possible: "The {targets} would be attacked, and a single piece would be doing it."},
  material: "A {gain} may be the payoff, if both sides' next choices allow it.",
  capture: {candidate: "{capture} would pocket a {piece}.", followup: "Further on, {capture} could pocket a {piece}."},
  playedCapture: {fact: "{move} comes loaded with a {motif}.", consequence: "{capture} pockets a {piece}."},
});

export const raccoonTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} grabs the chance: a {motif} is on the board right now.",
    played_possible: "{move} sets up a {motif} for later, if the replies play along.",
    allowed_immediate: "That hands {opponent} a chance: {action}, and a {motif} is sitting right there.",
    allowed_possible: "{opponent} might get a {motif} out of this later; the replies decide whether it's really on offer.",
    missed_immediate: "{best} had a {motif} on offer, and this move walks past it.",
    missed_possible: "{best} might have turned up a {motif}, depending on the replies.",
  },
  fork: {actual: "One piece now has its eye on the {targets} at once.", possible: "The {targets} would be attacked, every one of them by the same piece."},
  material: "There may be a {gain} to collect at the end, though nothing's collected until both sides have made their moves.",
  capture: {candidate: "{capture} would snag a {piece} on the spot.", followup: "If things go that way, {capture} could collect a {piece} later."},
  playedCapture: {fact: "{move} cashes in on a {motif}.", consequence: "With {capture}, a {piece} goes in the bag."},
});

export const kittenTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "Ooh, after {move} there's a {motif} sitting right on the board.",
    played_possible: "{move} could set up a {motif} later, if the replies cooperate.",
    allowed_immediate: "Psst: {opponent} has {action} ready, and it springs a {motif}.",
    allowed_possible: "A {motif} might be lurking for {opponent} later, depending on the replies.",
    missed_immediate: "{best} was hiding a {motif} up its sleeve.",
    missed_possible: "{best} might have sprung a {motif}, if the replies played along.",
  },
  fork: {actual: "One sneaky piece is poking at the {targets} together.", possible: "The {targets} would be attacked, and it would take only one sneaky piece."},
  material: "A {gain} may be the prize at the end of the trail, but both sides still get their say.",
  capture: {candidate: "{capture} would snatch a {piece}.", followup: "Down the road, {capture} might snatch a {piece}."},
  playedCapture: {fact: "{move} springs a sneaky {motif}.", consequence: "{capture} snatches a {piece}."},
});

export const dragonTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} delivers a {motif}, and it stands on the board now.",
    played_possible: "{move} prepares a {motif}; the replies decide if it ever arrives.",
    allowed_immediate: "{opponent} has {action} in reply, and with it a {motif}.",
    allowed_possible: "This gives {opponent} a possible {motif} later; the replies will settle it.",
    missed_immediate: "{best} had a {motif} ready, and this move declines it.",
    missed_possible: "{best} could have built toward a {motif}, replies permitting.",
  },
  fork: {actual: "The {targets} now sit under one piece's attack.", possible: "From a single square, the {targets} would be attacked by that one piece."},
  material: "A {gain} may be there in the end, but the remaining choices on both sides decide that.",
  capture: {candidate: "{capture} is there, and a {piece} would fall to it.", followup: "If play runs that way, a {piece} falls to {capture}."},
  playedCapture: {fact: "{move} is built on a {motif}.", consequence: "A {piece} falls to {capture}."},
});

export const velvetTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "I noticed it after {move}: a {motif}, sitting there on the board.",
    played_possible: "{move} leaves room for a {motif} later, if the replies let it happen.",
    allowed_immediate: "{opponent} can answer {action}, and with it comes a {motif}.",
    allowed_possible: "Further on, the replies may let {opponent} find a {motif}.",
    missed_immediate: "Inside {best}, quietly, sat a {motif}.",
    missed_possible: "{best} might have grown into a {motif}, had the replies allowed.",
  },
  fork: {actual: "A single piece has the {targets} in its reach at once.", possible: "One piece would do all the watching: the {targets} would be attacked together from it."},
  material: "Perhaps a {gain} at the end; it may be, but both sides still have moves to choose.",
  capture: {candidate: "A {piece} is there for {capture} to take.", followup: "Should the moves run that way, {capture} may come next and take a {piece}."},
  playedCapture: {fact: "{move} hides a {motif}.", consequence: "A {piece} is gone after {capture}."},
});

export const corgiTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} puts a {motif} on the board. Operation underway.",
    played_possible: "{move} lays the groundwork for a {motif}, pending the replies.",
    allowed_immediate: "Alert: {opponent} can reply {action}, arming a {motif}.",
    allowed_possible: "Later on, a {motif} could open for {opponent}; the replies will decide whether it materializes.",
    missed_immediate: "{best} had a {motif} on the launch pad.",
    missed_possible: "{best} might have opened a {motif}, pending the replies.",
  },
  fork: {actual: "One piece now has the {targets} in its sights.", possible: "The {targets} would be attacked, all from one post."},
  material: "A {gain} may be in it, but both sides still have orders to give.",
  capture: {candidate: "{capture} would knock out a {piece}.", followup: "Down the line, {capture} could remove a {piece}."},
  playedCapture: {fact: "{move} puts a {motif} into operation.", consequence: "{capture} sends a {piece} off the field."},
});

export const unicornTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, a lovely {motif} is woven into the position.",
    played_possible: "{move} sets the stage for a {motif}, should the replies allow it to bloom.",
    allowed_immediate: "With {action}, {opponent} has an answer that carries a {motif} along.",
    allowed_possible: "Later, perhaps, a {motif} could bloom for {opponent}, as the replies decide.",
    missed_immediate: "{best} carried a {motif} quietly within it.",
    missed_possible: "With kinder replies, {best} might have blossomed into a {motif}.",
  },
  fork: {actual: "A single piece reaches gracefully toward the {targets} at once.", possible: "From a single piece, the {targets} would be attacked in unison."},
  material: "A {gain} may be waiting at the far end, if the moves still to come unfold that way.",
  capture: {candidate: "{capture} would neatly claim a {piece}.", followup: "Should the story go that way, {capture} may follow and claim a {piece}."},
  playedCapture: {fact: "{move} brings a {motif} to life.", consequence: "{capture} claims a {piece}."},
});

export const expertTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "With {move}, a {motif} is in effect immediately.",
    played_possible: "{move} prepares a {motif}, conditional on the replies.",
    allowed_immediate: "{opponent} replies {action}, and that executes a {motif}.",
    allowed_possible: "A {motif} becomes available to {opponent} later, subject to the replies.",
    missed_immediate: "Unplayed resource: {best}, with an immediate {motif}.",
    missed_possible: "{best} offered a route to a {motif}, subject to the replies.",
  },
  fork: {actual: "Fork: one piece attacks the {targets} simultaneously.", possible: "Projected fork: the {targets} would be attacked in parallel from one square."},
  material: "Projected net material: a {gain} may be available at the end, pending both sides' choices.",
  capture: {candidate: "Available capture: {capture}, winning a {piece}.", followup: "If the line runs that way, {capture} may follow, winning a {piece}."},
  playedCapture: {fact: "{move} executes a {motif}.", consequence: "Material result: {capture}, and the {piece} is gone."},
});

export const gorillaTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "Big idea in {move}: a {motif}, live right now.",
    played_possible: "{move} could lead to a {motif} later; the replies will show if it comes.",
    allowed_immediate: "Simple problem: {action} is ready for {opponent}, and a {motif} comes with it.",
    allowed_possible: "Later, if the replies go a certain way, {opponent} may get a {motif} out of it.",
    missed_immediate: "The stronger choice, {best}, came with a {motif}.",
    missed_possible: "{best} might have built a {motif}, but the replies would decide that.",
  },
  fork: {actual: "One attacker, and the {targets} are all under its hit at once.", possible: "The {targets} would be attacked, every one, from a single square."},
  material: "A {gain} may be the reward here, yet both sides get more moves before anything is final.",
  capture: {candidate: "{capture} is there to win a {piece} on the spot.", followup: "Later on in that line, {capture} may win a {piece}."},
  playedCapture: {fact: "{move} comes down to one big thing: a {motif}.", consequence: "Down that road, {capture} picks up a whole {piece}."},
});
