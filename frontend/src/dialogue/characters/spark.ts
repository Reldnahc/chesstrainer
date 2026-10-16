import { coachPersonality } from "../personality";
import { authorTacticalWordings } from "../scopedTacticalWording";

export const sparkTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "Spicy: right away, {move} unleashes a {motif}.",
    played_possible: "{move} loads a {motif}, replies permitting.",
    allowed_immediate: "Eyes up: {opponent} can answer {action}, and a {motif} snaps shut.",
    allowed_possible:
      "Eyes up for later: a {motif} could spring for {opponent}, replies permitting.",
    missed_immediate: "{best} had a {motif} loaded and ready to fire.",
    missed_possible:
      "{best} might have loaded a {motif}, with the replies still to say their piece.",
  },
  fork: {
    actual: "One landing, and the {targets} are all in the crosshairs.",
    possible: "One landing, and the {targets} would be attacked in the same breath.",
  },
  material: "A {gain} may be up for grabs, with both sides still holding cards.",
  capture: {
    candidate: "Snap: {capture}, and that {piece} is history.",
    followup: "Further down the road, {capture} could gobble a {piece}.",
  },
  playedCapture: {
    fact: "{move} lights the fuse on a {motif}.",
    consequence: "Next, {capture} swallows the {piece}.",
  },
});

/** Whole authored sentences for the shared recognition/sequence meanings.
 * Neither recognition nor a consecutive run says that these moves were good. */
export const sparkOpeningTemplates = {
  "book-opening-entry-1": ["Repertoire time, courtesy of {opening}."],
  "book-opening-entry-2": ["Straight out of the repertoire, {opening}."],
  "book-opening-entry-3": ["A repertoire line with a name: {opening}."],
  "book-opening-follow-1": ["{opening}, and the repertoire rolls on."],
  "book-opening-follow-2": ["Another rehearsed move from {opening}."],
  "book-opening-follow-3": ["The reply is on script too, still {opening}."],
  "book-opening-follow-4": ["{opening} keeps flowing."],
  "book-opening-follow-5": ["No detours yet; this is {opening}."],
  "book-opening-follow-6": ["The script covers this, in {opening}."],
  "book-opening-follow-7": ["Cruising the main road of {opening}."],
  "book-opening-follow-8": ["Still {opening}: a pin on the map, not a verdict on the move."],
} as const;

export const spark = coachPersonality({
  version: "spark-4",
  maxCharacters: 280,
  maxClaims: 2,
  delivery: { pace: "lively", energy: "bright" },
  behavior: {
    general: "reaction-first",
    praise: "reaction-first",
    correction: "reaction-first",
    questionFrequency: "occasional",
    directness: 4,
    emotionalAmplitude: 5,
    humor: 3,
    jargon: 2,
    playerAddress: "direct",
    sentenceLength: "short",
    metaphor: "rare",
    signature:
      "Let the reaction land, name the punchline, and stop before the excitement becomes noise.",
  },
  bible: {
    temperament:
      "A bright tactical enthusiast who lights up when a concrete chess idea snaps into place.",
    teaching: "A quick reaction, the tactical punchline, then its supported consequence.",
    rhythm: "Short bursts with an occasional genuine invitation to test the idea.",
    celebration:
      'A sparing "Zing!" for the learner\'s sacrifice, hard resource or forcing connection that actually works.',
    correction:
      'A quick "eyes up" at the problem, then the specific reply, without teasing the player.',
    avoid:
      "Long dry paragraphs, constant exclamation marks, fake hype for routine moves, cheering for whichever side moved, or joking at the player's expense.",
  },
  templates: {
    ...sparkTacticalTemplates,
    ...sparkOpeningTemplates,
    allowed_mate: [
      {
        reaction: "Freeze frame.",
        fact: "The net is ready to snap shut: {opponent} gets to force mate.",
        consequence: "{reply}",
      },
    ],
    missed_mate: [
      { reaction: "Mate was on a plate.", fact: "{best} forced it, and the game slides past." },
    ],
    tactic_played: [
      {
        reaction: "Spicy.",
        fact: "Watch {move} spark off a {motif} in the searched line.",
        consequence: "{detail}",
      },
      {
        reaction: "Snap.",
        fact: "Down the searched line, {move} lights the fuse on a {motif}.",
        consequence: "{detail}",
      },
    ],
    tactic_allowed: [
      {
        reaction: "Eyes up.",
        fact: "Run the strongest line and {opponent} cashes in a {motif}.",
        consequence: "{detail}",
      },
    ],
    tactic_missed: [
      {
        reaction: "One to replay.",
        fact: "{best} had a {motif} loaded and waiting.",
        consequence: "{detail}",
      },
    ],
    cause_abandoned_defender: [
      {
        reaction: "Here's the leak.",
        fact: "{move} lures off {side}'s only unpinned defender, and the {piece} on {square} is left bare.",
        consequence: "{opponent} can pounce: {reply} takes it.",
      },
    ],
    cause_opponent_threat_recognition: [
      {
        reaction: "Psst.",
        fact: "The opponent's preceding move put {side}'s {piece} on {square} in the crosshairs, and {move} shrugs that off.",
        consequence: "Next, {opponent} can scoop it up: {reply}.",
      },
    ],
    cause_avoiding_bad_trades: [
      {
        reaction: "Two captures, not one.",
        fact: "{move} lets {side}'s {piece} go, and the return is a mere {captured}.",
        consequence: "{opponent} can recapture via {reply}, and the trade goes sour.",
      },
    ],
    sacrifice: [
      {
        reaction: "What if it's grabbed?",
        fact: "Even taken, the sacrifice keeps sizzling in the search.",
      },
    ],
    only_move: [
      {
        reaction: "The one rope that held.",
        fact: "Nothing else in the search kept the game playable.",
        takeaway: "Worth a replay.",
      },
    ],
    decisive_resource: [
      "Precision: of everything searched, just this move keeps the knockout edge.",
    ],
    reply_capture: [
      {
        reaction: "Little detail.",
        fact: "Watch for {reply}: {opponent} snatches {side}'s {piece} with it.",
      },
    ],
    reply_check: ["The sharpest thing {opponent} has is {reply}, and it checks."],
    alternative: [
      "Line {best} up beside it, and the search scores it {evaluation} for whoever moved.",
    ],
    loss: [
      {
        reaction: "That leaks value.",
        fact: "Stack it against the best line and {loss} pawns of evaluation drain away.",
        takeaway: "Line both replies up and race them.",
      },
    ],
    best: [
      {
        reaction: "Strong, and spicy with it.",
        fact: "Hardly any value goes missing with this one.",
      },
      { fact: "A strong move, and spicy; the search barely improves on it." },
    ],
    good: [{ reaction: "Holds water.", fact: "This keeps the value pretty much intact." }],
    uncertain_reason: [
      "{best} gets the engine's vote, but I can't back the reason with supported evidence yet.",
    ],
    human_natural_error: [
      {
        reaction: "Tempting, I know.",
        fact: "Natural, by the human-move model's clock, yet the reply turns it into a mistake.",
        takeaway: "Replay the reply and spot the difference.",
      },
    ],
    human_rare: [
      "The human-move model wouldn't bet on this, yet the engine's reply can't knock it over. Zing! Give the idea a second look.",
    ],
    difficult_defense: [
      "{best} would have held, and the human-move model clocks it as a deep cut. Replay it.",
    ],
    human_challenging: [
      {
        reaction: "Replay this one.",
        fact: "Per the human-move model, {best} was a sneaky one to find.",
      },
    ],
    human_defense_found: [
      {
        reaction: "What a save!",
        fact: "{best} saved the position, and the human-move model clocks that defense as a deep cut.",
      },
    ],
    human_natural_best: [
      "Gut pick and engine pick in one: natural on the human-move model's clock, untouchable in the search.",
    ],
    human_natural_strong: [
      "Natural for the human-move model, and it holds up as a strong move, though the engine keeps another favorite.",
    ],
    book: ["Repertoire time: {opening}."],
    book_sound: ["{opening}, straight from the repertoire."],
    departure: ["And we leave the repertoire. Off our charts from here."],
    recovery: [
      { reaction: "Back in it.", fact: "That wobble at {earlier} is steadied now.{help}" },
    ],
    punishment: [
      "There's the open door from {earlier}, and {side} pounces through it with this move.",
    ],
    missed_punishment: ["{earlier} cracked a door open for {side}, and this move strolls on by."],
    repeated: ["Spotted the {motif} issue {count} times already in the moves we reviewed."],
    support_restored: [
      "The {piece} lost its bodyguard at {earlier}, and the bodyguard is back. Replay that switch.",
    ],
    erosion: [
      "Tiny leaks since {earlier}, one after another, and together they've drained the position.",
    ],
    conversion: [
      "The edge rode all the way home: {side} grabbed it at {earlier} and kept it through the win.",
    ],
    history: ["One for the practice pile: this {motif} issue haunts {games} more saved games."],
    development: [
      { reaction: "Out it pops.", fact: "{lead}pops the {piece} out to join the party." },
    ],
    rook_file: [
      "{lead}leaves {side}'s rook sitting on a {kind} {file}-file, a lane worth watching.",
    ],
    passed: [
      "{lead}gives {side} brand-new passers on {squares}; the enemy has no pawn in front of them, not on their files and not on the files hugging them.",
    ],
    passer_advance: ["{lead}parks the passed pawn on {square} now. Closer every move."],
    isolated: [
      "{lead}leaves {side}'s pawns on {squares} stranded: no friendly pawn sits at their elbows on either side.",
    ],
    support: ["{lead}sends a bodyguard to the {piece} on {square}."],
    unsupported: [
      "{lead}leaves the {piece} on {square} flapping in the wind, no defender at all. By itself that's no death sentence.",
    ],
    flights: ["{lead}cuts an escape hatch: the king can now legally step to {squares}."],
    castle: ["{lead}castles: king to {square}, rook leaping over to stand guard."],
    bishops: ["{lead}breaks up {side}'s bishop duo."],
    doubled: [
      "{lead}leaves files {files} each holding a same-colored pair of {side}'s pawns: doubled.",
    ],
    mate_win: [{ reaction: "That's the finish!", fact: "Checkmate, and you sealed every exit." }],
    mate_loss: [
      {
        fact: "Checkmate. Your king is out of moves.",
        takeaway: "Let's rewind and dig up the defense.",
      },
    ],
    draw: ["Drawn game. Rewind to the spicy bits."],
    retry: [{ fact: "That one misses.", takeaway: "Swing again, and test the reply first." }],
    recovered: [{ reaction: "Now it snaps into place!", fact: "{detail}" }],
    accepted: [{ reaction: "That's the punchline.", fact: "{detail}" }],
    explanation: [{ reaction: "Watch it snap together.", fact: "{detail}" }],
    explanation_summary: ["Pocket this part: {detail}"],
    cold: ["Over to you. Look hard, then commit."],
    thinking: ["Testing the sharpest reply now…"],
    unavailable: ["No reliable engine answer yet, and I need one before naming a cause."],
    practice_error: ["That attempt fizzled. Swing again."],
    variation: ["Follow this road: {detail}"],
    compatibility: ["Here's the gist: {detail}"],
  },
});
