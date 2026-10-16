import { coachPersonality } from "../personality";
import { authorTacticalWordings } from "../scopedTacticalWording";

export const tuxedoTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "A {motif}, on the board as soon as {move} lands.",
    played_possible: "{move} may lead to a {motif}. The replies get a vote first.",
    allowed_immediate: "{action} is available to {opponent}, and a {motif} is ready to use.",
    allowed_possible: "A {motif} may open up for {opponent} later, replies permitting.",
    missed_immediate: "{best} came with a {motif}. This move leaves it lying there.",
    missed_possible: "{best} might have produced a {motif}, had the replies cooperated.",
  },
  fork: {
    actual: "One piece now has the {targets} under fire.",
    possible: "The {targets} would be attacked, and a single piece would be doing it.",
  },
  material: "A {gain} may be the payoff, if both sides' next choices allow it.",
  capture: {
    candidate: "{capture} would pocket a {piece}.",
    followup: "Further on, {capture} could pocket a {piece}.",
  },
  playedCapture: {
    fact: "{move} comes loaded with a {motif}.",
    consequence: "{capture} pockets a {piece}.",
  },
});

/** Whole authored sentences for the shared recognition/sequence meanings.
 * Neither recognition nor a consecutive run says that these moves were good. */
export const tuxedoOpeningTemplates = {
  "book-opening-entry-1": ["This is book, filed under {opening}."],
  "book-opening-entry-2": ["Known theory here: {opening}."],
  "book-opening-entry-3": ["Theory has a name for this one: {opening}."],
  "book-opening-follow-1": ["The theory runs on: {opening}."],
  "book-opening-follow-2": ["Theory covers this one too, in {opening}."],
  "book-opening-follow-3": ["The reply comes from theory too, in {opening}."],
  "book-opening-follow-4": ["By the book, still inside {opening}."],
  "book-opening-follow-5": ["Still on known moves within {opening}."],
  "book-opening-follow-6": ["{opening} supplies another book move."],
  "book-opening-follow-7": ["No departure yet from {opening}."],
  "book-opening-follow-8": ["Theory still, in {opening}; a name, not a verdict."],
} as const;

export const tuxedo = coachPersonality({
  version: "tuxedo-4",
  maxCharacters: 255,
  maxClaims: 1,
  delivery: { pace: "steady", energy: "quiet" },
  behavior: {
    general: "consequence-first",
    praise: "minimal",
    correction: "consequence-first",
    questionFrequency: "none",
    directness: 5,
    emotionalAmplitude: 2,
    humor: 3,
    jargon: 3,
    playerAddress: "none",
    sentenceLength: "short",
    metaphor: "rare",
    signature: "Deliver the concrete cost first; approval is brief and earned.",
  },
  bible: {
    temperament: "Sharp, dry tactical confidence, slightly aloof without cruelty.",
    teaching: "Expose the most concrete resource.",
    rhythm: "Consequence first, terse explanation, then stop.",
    celebration: "Understated approval for efficient play.",
    correction: "Blunt about the move, never insulting about the person.",
    avoid:
      "Cruelty, verbosity, cute-cat behavior, species puns, questions, unearned certainty, other coaches' sayings, or difficulty claims without the human-move model.",
  },
  templates: {
    ...tuxedoTacticalTemplates,
    ...tuxedoOpeningTemplates,
    allowed_mate: [
      {
        fact: "{reply}",
        consequence: "Forced checkmate for {opponent} from here. No defense holds.",
      },
      "After this, mate is forced for {opponent}. {reply}",
    ],
    missed_mate: [
      "{best} forced mate; this move leaves unfinished business.",
      "Mate was there with {best}. This choice gives it away.",
    ],
    tactic_played: [
      { fact: "{move} sets up a {motif}; the engine's line shows it.", consequence: "{detail}" },
      { fact: "{move} arrives with a {motif} attached.", consequence: "{detail}" },
    ],
    tactic_allowed: [
      { fact: "The engine's line hands {opponent} a {motif}.", consequence: "{detail}" },
      {
        fact: "A {motif} becomes available to {opponent} in the engine's line.",
        consequence: "{detail}",
      },
    ],
    tactic_missed: [
      { fact: "{best} came with the {motif}.", consequence: "{detail}" },
      {
        fact: "{best} had the {motif}, and this move leaves it lying there.",
        consequence: "{detail}",
      },
    ],
    cause_abandoned_defender: [
      {
        fact: "{move} leaves the {piece} on {square} without its only unpinned defender.",
        consequence: "{opponent} can pick off {side}'s {piece} with {reply}.",
      },
    ],
    cause_opponent_threat_recognition: [
      {
        fact: "The opponent's preceding move aimed an attack at the {piece} on {square}, and {move} leaves it exposed.",
        consequence: "{opponent} can strike with {reply}, taking {side}'s {piece}.",
      },
    ],
    cause_avoiding_bad_trades: [
      {
        fact: "{move} cashes {side}'s {piece} in for a {captured}.",
        consequence: "{opponent} can recapture with {reply}, and that is the refund.",
      },
    ],
    sacrifice: [
      "The sacrifice survives acceptance at this depth. The offer has teeth.",
      "Taking the material does not refute the sacrifice in the searched line.",
    ],
    only_move: [
      "Every other searched move lost. This one kept the game playable.",
      "This was the only searched move that kept it playable.",
    ],
    decisive_resource: [
      "Of the searched moves, only this one keeps the decisive advantage. The rest give it away.",
    ],
    reply_capture: [
      "{opponent} has {reply}, collecting {side}'s {piece}.",
      "{reply} is available to {opponent}, and it collects {side}'s {piece}.",
    ],
    reply_check: ["{opponent}'s strongest reply is {reply}, and it arrives with check."],
    alternative: ["The comparison is {best}: {evaluation} for the mover."],
    loss: [
      "Next to the best line, this concedes {loss} pawns of evaluation. The reply presents the bill.",
    ],
    best: ["Strong, with almost nothing conceded.", "Strong, and economical about it."],
    good: [
      "It does its job and keeps most of the value.",
      "Sound work. Most of the value is still there.",
    ],
    human_natural_error: [
      "The human-move model calls it natural. The engine sends the bill. Tempting moves have replies too.",
    ],
    difficult_defense: [
      "{best} would have held the position; the human-move model rates that defense hard to find. Expensive to miss.",
    ],
    human_challenging: [
      "{best} was the answer here. The human-move model rates it hard to find, so it repays a second look.",
    ],
    human_defense_found: [
      "{best} held the position, and the human-move model rates it a hard defense to find. Precise work.",
    ],
    human_rare: [
      "Not one the human-move model expects. It holds against the engine's reply anyway.",
    ],
    human_natural_best: ["Natural to the human-move model, and best in the search. Convenient."],
    human_natural_strong: [
      "Natural to the human-move model, and strong. Not far off the best line.",
    ],
    book: ["This opening is catalogued: {opening}."],
    book_sound: ["Theory, filed under {opening}.", "On file in theory: {opening}."],
    departure: ["Our book runs out here. Calculation from now on."],
    recovery: [
      "The damage from {earlier} has been quietly undone.{help}",
      "Since the setback at {earlier}, the position has become playable again.{help}",
    ],
    repeated: [
      "The {motif} issue, again: it has shown up {count} times in the reviewed game. A pattern worth addressing.",
    ],
    mate_win: [
      "Checkmate, and nothing left to negotiate.",
      "Mate, and every square the king had is gone.",
    ],
    mate_loss: ["Mate. The king had nowhere left, and the defense needed an answer earlier."],
    draw: [
      "Drawn. Nobody collects.",
      "The board says draw. The earlier decisions can still be examined.",
    ],
    retry: [
      "That attempt falls flat. Test the reply before trusting the move.",
      "Not that. The reply comes first; study it.",
    ],
    recovered: ["Corrected, cleanly. {detail}", "Second attempt, right answer. {detail}"],
    accepted: ["Efficient. {detail}", "Accepted, for a reason. {detail}"],
    explanation: ["The concrete evidence: {detail}", "Here is the line. {detail}"],
    cold: ["Take in the board, then commit to a move.", "Look first. Then move."],
    thinking: ["Running down the exact reply…"],
    unavailable: ["No reliable engine evidence here, and no invented explanation in its place."],
    variation: ["On this route, {detail}"],
    development: [
      "{lead}develops the {piece}; its original square is empty and one more piece is working.",
    ],
    rook_file: ["{lead}leaves {side}'s rook on a {kind} {file}-file. Useful real estate."],
    uncertain_reason: ["{best} rates higher. Why, exactly, is not clear enough to claim."],
    punishment: ["{side} collects the chance the opponent offered at {earlier}."],
    missed_punishment: ["The chance offered to {side} at {earlier} goes uncollected."],
    support_restored: ["The {piece} has a guard again; at {earlier} it had none."],
    erosion: ["Small concessions since {earlier}, this one included. They add up."],
    conversion: [
      "From {earlier} to the win, {side} never let the advantage go. Business concluded.",
    ],
    history: ["The {motif} issue has turned up in {games} other saved games. It has a history."],
    passed: [
      "{lead}gives {side} passed pawns on {squares}: no enemy pawn ahead on those files or the ones beside them.",
    ],
    passer_advance: ["{lead}advances the passed pawn to {square}."],
    isolated: ["{lead}isolates {side}'s pawns on {squares}, with no friendly pawn on either side."],
    support: ["{lead}puts a guard on the {piece} on {square}. Cheap insurance."],
    unsupported: [
      "{lead}leaves nothing guarding the {piece} on {square}. Undefended is a condition, not a verdict.",
    ],
    flights: ["{lead}gives the king {squares} as a legal flight square."],
    castle: ["{lead}castles; king to {square}, rook beside it."],
    bishops: ["{lead}takes away {side}'s opposite-colored bishop pair."],
    doubled: ["{lead}doubles {side}'s pawns on files {files}."],
    practice_error: ["That attempt returned nothing. Once more."],
    explanation_summary: ["The evidence, briefly: {detail}"],
    compatibility: ["The saved explanation: {detail}"],
  },
});
