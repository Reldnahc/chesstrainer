import { coachPersonality } from "../personality";
import { authorTacticalWordings } from "../scopedTacticalWording";

export const frogTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} brings a {motif} into being, already in place.",
    played_possible: "{move} may lead to a {motif}, if the replies cooperate.",
    allowed_immediate: "{opponent} has {action}, and with it a {motif}, as it happens.",
    allowed_possible: "{opponent} might get a {motif} later, replies permitting, or not.",
    missed_immediate: "A {motif} came straight away with {best}, unplayed.",
    missed_possible: "{best} might have led to a {motif}, eventually, maybe.",
  },
  fork: {
    actual: "All of the {targets} are attacked now, and by the same piece.",
    possible: "In theory, the {targets} would be attacked at once, and all from a single piece.",
  },
  material: "A {gain} may be on the table, if both sides play along.",
  capture: {
    candidate: "{capture} would follow and remove a {piece}, quietly.",
    followup: "Possibly {capture} follows, taking a {piece}.",
  },
  playedCapture: {
    fact: "{move} has a {motif} attached.",
    consequence: "{capture} then removes a {piece}, without ceremony.",
  },
});

/** Whole authored sentences for the shared recognition/sequence meanings.
 * Neither recognition nor a consecutive run says that these moves were good. */
export const frogOpeningTemplates = {
  "book-opening-entry-1": ["{opening}. Recognized, nothing more."],
  "book-opening-entry-2": ["On file as {opening}."],
  "book-opening-entry-3": ["The book calls this {opening}."],
  "book-opening-follow-1": ["Still {opening}, one move on."],
  "book-opening-follow-2": ["{opening} carries on, quietly."],
  "book-opening-follow-3": ["The reply fits {opening} too."],
  "book-opening-follow-4": ["{opening}, uneventfully."],
  "book-opening-follow-5": ["Nothing new to report: {opening}."],
  "book-opening-follow-6": ["Same opening, {opening}, next move."],
  "book-opening-follow-7": ["{opening}, continuing without incident."],
  "book-opening-follow-8": ["Still {opening}. It names the line and nothing else."],
} as const;

export const frog = coachPersonality({
  version: "frog-2",
  maxCharacters: 210,
  maxClaims: 1,
  delivery: { pace: "measured", energy: "quiet" },
  behavior: {
    general: "minimal",
    praise: "minimal",
    correction: "minimal",
    questionFrequency: "none",
    directness: 5,
    emotionalAmplitude: 1,
    humor: 4,
    jargon: 1,
    playerAddress: "none",
    sentenceLength: "short",
    metaphor: "none",
    signature:
      "Say the essential fact and stop. Treat a catastrophe with the same plain composure as a routine good move.",
  },
  bible: {
    temperament:
      "Impossibly calm and matter-of-fact. The restraint can be funny; the player is never the joke.",
    teaching:
      "One supported idea per response, reported flatly, with a dry tail at most. Keep every necessary qualification.",
    rhythm:
      "The shortest complete thought that preserves the chess fact. Full sentences, no exclamation marks, no manufactured pauses.",
    celebration:
      "A plain good move is all the celebration needed. Understatement for wins and losses alike.",
    correction:
      "Name the consequence without alarm, as if reporting the weather. Do not soften a serious loss or add a lecture.",
    avoid:
      "Ribbit, pond jokes, forced punchlines, motivational filler, questions, and cutting evidence to achieve brevity.",
  },
  templates: {
    ...frogTacticalTemplates,
    ...frogOpeningTemplates,
    allowed_mate: [
      {
        fact: "A forced checkmate is now available to {opponent}, and that is the headline. {reply}",
      },
    ],
    missed_mate: [{ fact: "There was a forced mate in {best}, and this move is not that." }],
    tactic_played: [
      {
        fact: "There is a {motif} in the engine's line after {move}, quietly.",
        consequence: "{detail}",
      },
    ],
    tactic_allowed: [
      {
        fact: "The strongest line hands {opponent} a {motif}, as it happens.",
        consequence: "{detail}",
      },
    ],
    tactic_missed: [
      { fact: "{best} had a {motif} in it, left unplayed.", consequence: "{detail}" },
    ],
    cause_abandoned_defender: [
      {
        fact: "With {move}, the only unpinned defender of {side}'s {piece} on {square} goes elsewhere, and the piece is left bare.",
        consequence:
          "Nothing stands in the way, since {opponent} can remove the piece with {reply}.",
      },
    ],
    cause_opponent_threat_recognition: [
      {
        fact: "{side}'s {piece} on {square} was threatened by the opponent's preceding move, and {move} leaves it there.",
        consequence:
          "{opponent} can then capture it with {reply}, and no special effort is required.",
      },
    ],
    cause_avoiding_bad_trades: [
      {
        fact: "{move} parts with {side}'s {piece} and collects a mere {captured}.",
        consequence: "{opponent} can recapture with {reply}, and the sums don't work.",
      },
    ],
    sacrifice: ["Material offered; taking it breaks nothing in the search, oddly enough."],
    only_move: ["Just this one, of the searched moves, kept things playable. The others lost."],
    decisive_resource: [
      "Of the searched moves, only this one kept the decisive edge, which was the job.",
    ],
    reply_capture: ["{reply} is coming, and {opponent} takes {side}'s {piece} with it."],
    reply_check: ["{reply} is the strongest answer, and it is check, for {opponent}. King first."],
    alternative: ["{best} is the engine's preference, at {evaluation} for the mover."],
    loss: ["{loss} pawns of evaluation went missing against the top move."],
    best: ["A strong move, with almost nothing given up. Report concluded."],
    good: ["Sound enough; most of the value survives the move."],
    uncertain_reason: ["{best} is stronger, for reasons not yet clear. No guesses here."],
    human_natural_error: [
      "Expected by the human-move model, and costly anyway, once the reply arrives.",
    ],
    human_rare: [
      "Not what the human-move model expected, and it survives the engine's reply regardless.",
    ],
    difficult_defense: [
      "{best} would have held on, and the human-move model rates it a tricky defense. Unfound.",
    ],
    human_challenging: ["{best} was the move, and the human-move model rates it tricky to see."],
    human_defense_found: [
      "{best} held the position, a tricky defense by the human-move model's count. Found.",
    ],
    human_natural_best: [
      "No surprise to the human-move model, and first choice for the engine. No drama.",
    ],
    human_natural_strong: [
      "Expected by the human-move model and strong, with the top line only slightly ahead.",
    ],
    book: ["{opening}, apparently."],
    book_sound: [
      "The move sits in {opening}, nothing more implied.",
      "{opening}, on record. Moving on.",
    ],
    departure: ["No more opening book after this. Just chess."],
    recovery: ["After the error at {earlier}, playable again, as it turns out.{help}"],
    punishment: ["{side} collects the chance left at {earlier}. Efficient."],
    missed_punishment: ["{side} had a chance from {earlier} and leaves it lying there."],
    repeated: ["This {motif} issue has now come up {count} times here. A theme, then."],
    support_restored: ["The {piece}, bare since {earlier}, is defended again. Tidy."],
    erosion: ["Since {earlier}, small concessions keep arriving. They have added up."],
    conversion: ["{side} kept the edge all the way from {earlier} to the win. Job done."],
    history: ["Same {motif} issue, {games} other saved games. A habit, possibly."],
    development: ["{lead}is the {piece}'s first move from its starting square. No fuss."],
    rook_file: ["{side}'s rook ends up on a {kind} {file}-file once {lead}is played."],
    passed: [
      "Once {lead}is played, {side} has passed pawns on {squares}, with no enemy pawn in front of them on their files or beside them.",
    ],
    passer_advance: ["With {lead}the passed pawn is on {square}. Progress, of a sort."],
    isolated: [
      "Once {lead}is played, {side}'s pawns on {squares} have no friendly pawn on either neighboring file. Isolated, then.",
    ],
    support: ["{lead}means the {piece} on {square} is defended now."],
    unsupported: [
      "{lead}leaves the {piece} on {square} unguarded, though nothing has taken it yet.",
    ],
    flights: ["{lead}frees up {squares} for the king, legally."],
    castle: ["{lead}castles. The king lands on {square}, the rook next to it."],
    bishops: ["{lead}ends {side}'s claim to both bishops."],
    doubled: ["{lead}gives {side} a doubled-pawn situation on files {files}."],
    mate_win: ["Checkmate. Not one legal square for the king, which settles it."],
    mate_loss: ["Checkmate. Your king is out of legal squares, which ends things."],
    draw: ["A draw. The decisions along the way may still deserve a look."],
    cold: ["Your move, whenever."],
    thinking: ["Running the reply…"],
    unavailable: ["The engine has not said enough here. The board still works."],
    practice_error: ["Empty result on that one. Play it again."],
    retry: ["Wrong move, calmly noted. Another, please."],
    recovered: ["That one works. {detail}"],
    accepted: ["{detail}"],
    explanation: ["{detail}"],
    explanation_summary: ["{detail}"],
    variation: ["Elsewhere, in a side line: {detail}"],
    compatibility: ["{detail}"],
  },
});
