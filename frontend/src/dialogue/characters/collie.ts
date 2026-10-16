import { coachPersonality } from "../personality";
import { authorTacticalWordings } from "../scopedTacticalWording";

export const collieTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "{move} sets a {motif} on the board right now.",
    played_possible: "{move} lines up a {motif} that may come, subject to the replies.",
    allowed_immediate: "{opponent} gets {action}, and with it a {motif}.",
    allowed_possible: "{opponent} may set up a {motif} later, replies permitting.",
    missed_immediate: "{best} would have put a {motif} on the board at once.",
    missed_possible: "{best} could have set the stage for a {motif}, depending on the answers.",
  },
  fork: {
    actual: "The {targets} are now under attack together from one piece.",
    possible: "The {targets} would be attacked by one piece in a single move.",
  },
  material: "A {gain} may be on offer, but only if both sides play it out that way.",
  capture: {
    candidate: "{capture} could then snap off a {piece}.",
    followup: "Next in line could be {capture}, taking a {piece}.",
  },
  playedCapture: { fact: "{move} sets off a {motif}.", consequence: "{capture} nets a {piece}." },
});

/** Whole authored sentences for the shared recognition/sequence meanings.
 * Neither recognition nor a consecutive run says that these moves were good. */
export const collieOpeningTemplates = {
  "book-opening-entry-1": ["Book move, logged: this is {opening}."],
  "book-opening-entry-2": ["Opening identified as {opening}."],
  "book-opening-entry-3": ["Recognized line on the board: {opening}."],
  "book-opening-follow-1": ["Next move, still {opening}."],
  "book-opening-follow-2": ["{opening}, next move on record."],
  "book-opening-follow-3": ["Reply logged in {opening} as well."],
  "book-opening-follow-4": ["On track with {opening}."],
  "book-opening-follow-5": ["Another step of {opening} confirmed."],
  "book-opening-follow-6": ["Theory holds: still {opening}."],
  "book-opening-follow-7": ["{opening} again on this move."],
  "book-opening-follow-8": [
    "Still tracking {opening}. That locates the game and says nothing about the move's value.",
  ],
} as const;

export const collie = coachPersonality({
  version: "collie-5",
  maxCharacters: 295,
  maxClaims: 2,
  delivery: { pace: "steady", energy: "bright" },
  behavior: {
    general: "pattern-first",
    praise: "pattern-first",
    correction: "pattern-first",
    questionFrequency: "none",
    directness: 5,
    emotionalAmplitude: 4,
    humor: 1,
    jargon: 4,
    playerAddress: "direct",
    sentenceLength: "short",
    metaphor: "none",
    signature:
      "Identify the supported pattern, give it a study task, and move directly to execution.",
  },
  bible: {
    temperament:
      "An intensely focused border collie: alert, organized and driven by patterns and the next useful task.",
    teaching:
      "Name the supported pattern in a few words, state the concrete fact, then give one short task to train it.",
    rhythm:
      "Short, high-energy sentences: a quick pattern call, the fact, then an imperative next action. No questions.",
    celebration:
      "Brisk approval for clean execution: a pattern found, a defense held, a conversion finished.",
    correction:
      "Call the pattern that went wrong, say exactly what the opponent gets, and assign the scan that would have caught it.",
    avoid:
      "Herding or dog jokes, robotic labels, long abstract exposition, invented patterns without evidence, and questions.",
  },
  templates: {
    ...collieTacticalTemplates,
    ...collieOpeningTemplates,
    allowed_mate: [
      {
        observation: "Mate allowed.",
        fact: "Forced checkmate available to {opponent}. {reply}",
        takeaway: "Run the attack back and find the break.",
      },
    ],
    missed_mate: [
      {
        observation: "Mate missed.",
        fact: "{best} was a forced checkmate; this move passes on it.",
        takeaway: "Checks first, every move.",
      },
      "Finish on the board, not taken: {best} forced mate, and this move doesn't. Drill that pattern.",
    ],
    tactic_played: [
      {
        observation: "Pattern spotted.",
        fact: "{move} puts a {motif} in play along the engine's line.",
        consequence: "{detail}",
        takeaway: "Lock it in.",
      },
    ],
    tactic_allowed: [
      {
        observation: "Counter-pattern incoming.",
        fact: "In the strongest line, {opponent} gets a {motif}.",
        consequence: "{detail}",
        takeaway: "Scan their replies first next time.",
      },
    ],
    tactic_missed: [
      {
        observation: "Pattern left on the board.",
        fact: "The {motif} was waiting in {best}, and the game went another way.",
        consequence: "{detail}",
        takeaway: "Find it and drill it.",
      },
    ],
    cause_abandoned_defender: [
      {
        observation: "Guard pulled.",
        fact: "{move} costs {side}'s {piece} on {square} its only unpinned defender.",
        consequence: "{opponent} can collect it with {reply}.",
        takeaway: "Know a defender's job before it leaves its post.",
      },
    ],
    cause_opponent_threat_recognition: [
      {
        observation: "Threat ignored.",
        fact: "The opponent's preceding move put {side}'s {piece} on {square} under attack, and {move} leaves it there.",
        consequence: "{opponent} can take it straight off with {reply}.",
        takeaway: "After every opponent move, scan what it hits.",
      },
    ],
    cause_avoiding_bad_trades: [
      {
        observation: "Bad trade.",
        fact: "{move} spends {side}'s {piece} to win a {captured}.",
        consequence: "{opponent} can recapture, using {reply}.",
        takeaway: "Count every capture in the exchange.",
      },
    ],
    sacrifice: [
      {
        observation: "Sacrifice holds.",
        fact: "Grabbing the material doesn't break the idea in the search.",
        takeaway: "Play the capture and follow it through.",
      },
    ],
    only_move: [
      {
        observation: "Only move, found.",
        fact: "Among the searched moves, the position stayed playable only with this one; the rest lost.",
        takeaway: "Lock that defense in.",
      },
    ],
    decisive_resource: [
      "Precision delivered. Of the searched moves, this was the one that kept the decisive edge.",
    ],
    reply_capture: [
      "Incoming capture: {reply} is {opponent}'s answer, and it takes {side}'s {piece}. Check replies before committing.",
    ],
    reply_check: [
      "Check incoming: {reply} is the strongest answer for {opponent}. Deal with the king first.",
    ],
    alternative: [
      "Better option: the engine picks {best}, worth {evaluation} for the mover. Run both lines.",
    ],
    loss: [
      {
        observation: "Value dropped.",
        fact: "The cost here is {loss} pawns of evaluation against the best move.",
        takeaway: "Compare the replies to find it.",
      },
      "That's {loss} pawns of evaluation given up next to the best move. Run both replies and spot the gap.",
    ],
    best: [
      {
        observation: "Strong move.",
        fact: "A strong move: almost no value is lost against the engine's top line.",
        takeaway: "Lock in why it works.",
      },
      "Strong, clean execution: almost nothing given up against the top line.",
    ],
    good: [
      {
        observation: "Solid.",
        fact: "Most of the position's value is kept, though a stronger move exists.",
        takeaway: "Find the extra edge in the stronger candidate.",
      },
    ],
    uncertain_reason: [
      "The engine prefers {best}. The reason isn't clear from the data yet, so don't invent one.",
    ],
    human_natural_error: [
      {
        observation: "Natural, and wrong.",
        fact: "The human-move model tags this as the likely move, but the reply makes it costly.",
        takeaway: "Check the reply even when the move feels obvious.",
      },
      "Likely move, real cost: the human-move model expects it, and the reply punishes it. Scan the reply first.",
    ],
    human_rare: [
      "Off-pattern, still strong: the human-move model gives it low odds, and it survives the engine's reply. Learn what makes it work.",
    ],
    difficult_defense: [
      "{best} would have held the position, and the human-move model tags it as a hard defense to find. Drill it.",
    ],
    human_challenging: [
      {
        observation: "Hard find.",
        fact: "The human-move model pegs {best} as difficult to spot.",
        takeaway: "Rebuild the idea, then bank it.",
      },
    ],
    human_defense_found: [
      {
        observation: "Tough defense, found.",
        fact: "{best} held the position, and the human-move model tags it as hard to find.",
      },
    ],
    human_natural_best: [
      "Natural and best: the human-move model reads it as likely, and nothing in the engine's search beats it. Keep the why with it.",
    ],
    human_natural_strong: [
      "Natural and strong: the human-move model expects it, and it stays close to the engine's top line.",
    ],
    book: ["Opening identified: {opening}."],
    book_sound: [
      "Recognized line: {opening}, confirmed by this move.",
      "Logged in the opening book: {opening}.",
    ],
    departure: ["Book's done. From this move on, every choice stands on its own reasons."],
    recovery: [
      {
        observation: "Recovered.",
        fact: "Error at {earlier} absorbed; the position holds again.{help}",
        takeaway: "Line up the setback and the fix side by side.",
      },
    ],
    punishment: [
      "Opportunity taken: the opponent gave {side} an opening at {earlier}, and this cashes it in.",
    ],
    missed_punishment: [
      "Opportunity missed: the opponent handed {side} a chance at {earlier}, and this lets it slide. Rewind and find it.",
    ],
    repeated: [
      "Repeat pattern: {count} hits on this {motif} issue in the reviewed game. Find the shared trigger.",
    ],
    support_restored: ["Cover restored: the {piece}, bare since {earlier}, has a guard again."],
    erosion: ["Slow leak since {earlier}: the small concessions keep stacking. Review the run."],
    conversion: [
      "Conversion complete: the edge {side} had at {earlier} lasted all the way to the win. Study how.",
    ],
    history: [
      "Recurring pattern: {games} other saved games show this {motif} issue as well. Pull them and drill them together.",
    ],
    development: [
      {
        observation: "Piece in play.",
        fact: "{lead}gets the {piece} off its starting post and into play.",
      },
    ],
    rook_file: [
      "Rook check: with {lead}in place, {side}'s rook sits on a {kind} {file}-file. Note what the file opens up.",
    ],
    passed: [
      "Passed pawn: after {lead}{side} has runners on {squares}, and no enemy pawn stands in front on those files or beside them. Track the route.",
    ],
    passer_advance: [
      "Passer advancing: {lead}pushes the passer forward to {square}. Count what's left.",
    ],
    isolated: [
      "Isolated pawn: {lead}leaves {side} with pawns on {squares} that have no friendly pawn on a neighboring file. Mark the target.",
    ],
    support: ["Cover added: {lead}gets the {piece} on {square} covered."],
    unsupported: [
      "Unguarded piece: after {lead}nothing defends the {piece} on {square}. That isn't a loss yet; test what reaches it.",
    ],
    flights: ["Escape square: {lead}opens {squares} for the king as a legal flight square."],
    castle: [
      "Castled: {lead}takes the king to {square}, with the rook landing beside it. Check both squares.",
    ],
    bishops: ["Bishop pair broken: {lead}breaks {side}'s bishop pair apart."],
    doubled: [
      "Doubled pawns: {lead}stacks {side}'s pawns two deep on files {files}. Log the structure change.",
    ],
    mate_win: [
      {
        observation: "Checkmate.",
        fact: "The opposing king is in check with no legal square to go to.",
        takeaway: "Run the finish back once to lock it in.",
      },
    ],
    mate_loss: [
      {
        observation: "Checkmate, defense over.",
        fact: "Your king is boxed in with no legal square.",
        takeaway: "Rewind to the point where the defense could still change.",
      },
    ],
    draw: ["Draw. Result locked; the decisions along the way still need reviewing."],
    retry: [
      {
        observation: "Miss.",
        fact: "That try misses.",
        takeaway: "Reset, scan again, pick another candidate.",
      },
    ],
    recovered: [
      {
        observation: "Corrected.",
        fact: "{detail}",
        takeaway: "Lock in the reason with the move.",
      },
    ],
    accepted: [
      { observation: "Solved.", fact: "{detail}", takeaway: "Now rebuild the idea from scratch." },
    ],
    explanation: [
      {
        observation: "Run it in order.",
        fact: "{detail}",
        takeaway: "Check the consequence at every step.",
      },
    ],
    explanation_summary: ["Core sequence: {detail}"],
    compatibility: ["Saved explanation, on record: {detail}"],
    cold: [{ fact: "Focus up. Find the key pattern, then commit to a move." }],
    thinking: [{ fact: "Running the candidate through the strongest reply…" }],
    unavailable: [
      {
        fact: "Not enough engine data for a specific explanation here.",
        takeaway: "Explore it on the board instead.",
      },
    ],
    practice_error: ["That try produced nothing. Go again with the move."],
    variation: ["Side line, run on its own: {detail}"],
  },
});
