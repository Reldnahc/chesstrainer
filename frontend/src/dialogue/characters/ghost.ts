import type {CoachPersonality} from "../personality";
import {authorTacticalWordings} from "../scopedTacticalWording";

/** Wisp's scoped tactical forms: what is already on the board, what waits for a
 * reply, and what an unplayed move would have held. */
export const ghostTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "After {move}, a {motif} is already in place.",
    played_possible: "A {motif} may come after {move}, if the replies allow it.",
    allowed_immediate: "{opponent} can reply with {action}. A {motif} is waiting there.",
    allowed_possible: "Later, a {motif} may be there for {opponent}. The replies decide whether it comes.",
    missed_immediate: "{best} held a {motif}. This move leaves it behind.",
    missed_possible: "{best} may have held a {motif}; the replies would have decided.",
  },
  fork: {actual: "One attacker now touches the {targets}.", possible: "The {targets} would be attacked by a single piece."},
  material: "A {gain} may be the result, but both sides still have moves to make.",
  capture: {candidate: "{capture} would remove a {piece}.", followup: "Later, {capture} may follow, taking a {piece}."},
  playedCapture: {fact: "{move} carries a {motif}.", consequence: "With {capture}, a {piece} is taken."},
});

/** Whole sentences for the shared recognition/sequence meanings. A recorded
 * opening says where the game is, never that a move was good. */
export const ghostOpeningTemplates = {
  "book-opening-entry-1": ["This move belongs to a known opening: {opening}."],
  "book-opening-entry-2": ["A known opening takes shape: {opening}."],
  "book-opening-entry-3": ["The book knows this move. It belongs to {opening}."],
  "book-opening-follow-1": ["Still in the book: {opening}."],
  "book-opening-follow-2": ["The book holds this move too, in {opening}."],
  "book-opening-follow-3": ["The reply is known as well: {opening}."],
  "book-opening-follow-4": ["The known line goes on through {opening}."],
  "book-opening-follow-5": ["Still on recorded ground, in {opening}."],
  "book-opening-follow-6": ["Another known move. {opening} continues."],
  "book-opening-follow-7": ["The book has not ended yet: {opening}."],
  "book-opening-follow-8": ["Again, a book move in {opening}."],
} as const;

export const ghost: CoachPersonality = {
  version: "ghost-2", maxCharacters: 245, maxClaims: 2, tacticalWording: "witness", openingWording: "sequence",
  delivery: {pace: "measured", energy: "quiet"},
  behavior: {
    general: "observation-first", praise: "observation-first", correction: "observation-first",
    questionFrequency: "none", directness: 4, emotionalAmplitude: 1,
    humor: 1, jargon: 2, playerAddress: "occasional", sentenceLength: "short", metaphor: "rare",
    signature: "Notice what remains on the board, name the danger quietly, and allow a short conclusion to carry the weight.",
  },
  bible: {
    temperament: "A quiet watcher, attentive to threats and to what a move leaves behind.",
    teaching: "Start from an observed change, then reveal its supported consequence without theatrical suspense.",
    rhythm: "Short complete sentences with space between observation and conclusion; restrained even in a lost position.",
    celebration: "Notice the resource with very little ceremony. Good defense is acknowledged as carefully as an attack.",
    correction: "Point out the remaining danger. Refer to earlier threats only when the evidence establishes them.",
    avoid: "Boo jokes, horror prose, predictions without evidence, invented hidden threats, generic mystery, or mind-reading.",
  },
  templates: {
    ...ghostTacticalTemplates,
    ...ghostOpeningTemplates,
    allowed_mate: [
      {observation: "The king's defense no longer holds.", fact: "{opponent} can now force checkmate.", consequence: "{reply}"},
      {fact: "After this move, {opponent} has a forced mate. {reply}"},
    ],
    missed_mate: [
      {fact: "A forced mate was there with {best}.", consequence: "This move leaves it behind."},
      "{best} held a forced mate. After the played move, it is gone.",
    ],
    tactic_played: [
      {observation: "This move holds more than it shows.", fact: "{move} carries a {motif} in the searched line.", consequence: "{detail}"},
      {fact: "The point of {move} is a {motif}.", consequence: "{detail}"},
    ],
    tactic_allowed: [
      {observation: "Something is left for the other side.", fact: "{opponent} has a {motif} in the strongest line.", consequence: "{detail}"},
      {fact: "This leaves {opponent} a {motif} in the searched line.", consequence: "{detail}"},
    ],
    tactic_missed: [
      {observation: "Another move had more in it.", fact: "{best} held a {motif}.", consequence: "{detail}"},
      {fact: "The {motif} was there with {best}; this move leaves it unused.", consequence: "{detail}"},
    ],
    cause_abandoned_defender: [
      {observation: "The danger is already there.", fact: "{move} takes the only unpinned defender away from {side}'s {piece} on {square}.", consequence: "{opponent} can take it with {reply}."},
      {fact: "With {move}, {side}'s {piece} on {square} loses its only unpinned defender.", consequence: "{opponent} can reply {reply}, capturing what was left behind."},
    ],
    cause_opponent_threat_recognition: [
      {fact: "The attack on {side}'s {piece} on {square} came with the opponent's preceding move. After {move}, it is still there.", consequence: "{opponent} can capture with {reply}."},
    ],
    cause_avoiding_bad_trades: [
      {fact: "{move} trades {side}'s {piece} for a {captured}.", consequence: "Then the recapture: {opponent} has {reply}."},
    ],
    sacrifice: [
      {observation: "The material is offered.", fact: "Even accepted, the sacrifice holds."},
      "Taking the offer does not refute it. The sacrifice stands.",
    ],
    only_move: [
      {observation: "Little room remained.", fact: "Among the searched moves, this alone kept the position playable."},
      {fact: "The other searched moves lost. This one held."},
    ],
    decisive_resource: ["Among the searched moves, only this one kept the decisive advantage. Every other choice let it go."],
    best: ["A strong move. Very little of the position's value is given up.", "Strong, and without fuss. Very little is given away here."],
    good: ["A sound move. Most of the position's value stays.", "Sound. Most of what the position held is still there."],
    loss: [
      {observation: "Something is lost here.", fact: "This gives up {loss} pawns of evaluation against the best move."},
      "Against the best move, {loss} pawns of evaluation are gone. The reply shows where.",
    ],
    alternative: ["{best} was the other path, at {evaluation} for the mover."],
    reply_capture: ["The reply is already there: {opponent} has {reply}, which takes {side}'s {piece}."],
    reply_check: ["{opponent}'s strongest reply is {reply}. It comes with check."],
    human_natural_error: ["The move looks ordinary, and the reply makes it costly. That is a natural mistake."],
    human_challenging: ["{best} was a hard move to see. The idea is still there to learn."],
    human_defense_found: ["The position held with {best}. It was a hard defense to see."],
    difficult_defense: ["A defense existed: {best}. It was difficult to see, and it would have held."],
    human_rare: ["An unusual move. Against the engine's reply, it still stands."],
    human_natural_best: ["A natural move, and the engine's best. Here they are the same move."],
    human_natural_strong: ["A natural, strong move. It gives up little against the best continuation."],
    uncertain_reason: ["{best} was the stronger move. The reason has not shown itself yet."],
    book: ["The name of this opening: {opening}."],
    book_sound: ["This move belongs to {opening}, a line on record."],
    departure: ["The known opening ends here. What follows is the board alone."],
    recovery: ["After {earlier}, the position is playable again.{help}", "The error at {earlier} is behind it. This makes the position playable again.{help}"],
    repeated: ["This {motif} issue has come back. {count} times now, in the reviewed game."],
    history: ["This {motif} issue has been here before, in {games} other saved games."],
    support_restored: ["The {piece} is guarded again. It stood alone at {earlier}."],
    punishment: ["At {earlier}, the opponent left {side} an opening. This move takes it."],
    missed_punishment: ["At {earlier}, the opponent left {side} a chance. It goes unused here."],
    erosion: ["Since {earlier}, the position has worsened through small concessions. This is one more of them."],
    conversion: ["The advantage {side} held at {earlier} lasted to the win."],
    development: ["{lead}develops the {piece}; its original square stands empty now."],
    rook_file: ["{lead}leaves {side}'s rook standing on a {kind} {file}-file."],
    passed: ["{lead}leaves {side} passed pawns on {squares}. No enemy pawn is in front of them, on those files or the ones beside them."],
    passer_advance: ["{lead}moves the passed pawn on to {square}, nearer the last rank."],
    isolated: ["{lead}leaves {side}'s pawns on {squares} isolated. No friendly pawn stands on a file beside them."],
    support: ["{lead}gives the {piece} on {square} a defender."],
    unsupported: ["{lead}leaves the {piece} on {square} with no defender. That alone does not prove it can be taken."],
    flights: ["{lead}opens {squares} for the king. A legal flight square now exists."],
    castle: ["{lead}takes the king to {square} by castling. The rook crosses with it."],
    bishops: ["{lead}breaks up {side}'s pair of opposite-colored bishops."],
    doubled: ["{lead}leaves {side} doubled pawns on files {files}. They stand one behind another."],
    clock_low: ["{side} had {seconds} seconds left before the move. Very little."],
    clock_fast: ["{side} moved after {elapsed} seconds, with {seconds} seconds still on the clock."],
    clock_long: ["{side} took {elapsed} seconds over this move. A long time to stay with one position."],
    mate_win: ["Checkmate. The king has no legal escape left.", "No legal square remains for the king. Checkmate, and the attack is complete."],
    mate_loss: ["Checkmate. No legal square is left for your king. The earlier defense is where to look."],
    draw: ["The game ends drawn. The earlier decisions are still there to examine."],
    retry: ["That attempt misses it. The idea is still on the board.", "Not that move. The answer is already in the position."],
    recovered: ["Found, on a second look. {detail}", "It was there all along. {detail}"],
    accepted: ["The reason stays with the move. {detail}", "This is what the move rests on. {detail}"],
    explanation: ["Follow the line through. {detail}", "Watch what changes as it plays out. {detail}"],
    cold: ["Everything needed is on the board. Choose your move.", "The position is set. Take it in, then move."],
    thinking: ["Following the move to its strongest reply…"],
    unavailable: ["The engine has left nothing to go on here. The board is open to you, but I cannot explain this position yet."],
    variation: ["Down this other line, {detail}"],
    practice_error: ["Nothing came back from that attempt. Try the move again."],
    explanation_summary: ["What remains, when the line is done: {detail}"],
    compatibility: ["{detail}"],
  },
};
