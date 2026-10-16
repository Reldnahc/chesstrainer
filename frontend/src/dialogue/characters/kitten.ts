import { coachPersonality } from "../personality";
import { authorTacticalWordings } from "../scopedTacticalWording";

export const kittenTacticalTemplates = authorTacticalWordings({
  scope: {
    played_immediate: "Ooh, after {move} there's a {motif} sitting right on the board.",
    played_possible: "{move} could set up a {motif} later, if the replies cooperate.",
    allowed_immediate: "Psst: {opponent} has {action} ready, and it springs a {motif}.",
    allowed_possible: "A {motif} might be lurking for {opponent} later, depending on the replies.",
    missed_immediate: "{best} was hiding a {motif} up its sleeve.",
    missed_possible: "{best} might have sprung a {motif}, if the replies played along.",
  },
  fork: {
    actual: "One sneaky piece is poking at the {targets} together.",
    possible: "The {targets} would be attacked, and it would take only one sneaky piece.",
  },
  material:
    "A {gain} may be the prize at the end of the trail, but both sides still get their say.",
  capture: {
    candidate: "{capture} would snatch a {piece}.",
    followup: "Down the road, {capture} might snatch a {piece}.",
  },
  playedCapture: {
    fact: "{move} springs a sneaky {motif}.",
    consequence: "{capture} snatches a {piece}.",
  },
});

/** Whole authored sentences for the shared recognition/sequence meanings.
 * Neither recognition nor a consecutive run says that these moves were good. */
export const kittenOpeningTemplates = {
  "book-opening-entry-1": ["Ooh, I know this trail! It's {opening}."],
  "book-opening-entry-2": ["Name tag on this move: {opening}."],
  "book-opening-entry-3": ["Seen it before! {opening} includes this move."],
  "book-opening-follow-1": ["The book hasn't left our side: {opening}."],
  "book-opening-follow-2": ["{opening} has this one on its pages too."],
  "book-opening-follow-3": ["Look, the reply is book too, straight out of {opening}."],
  "book-opening-follow-4": ["The trail through {opening} keeps on going."],
  "book-opening-follow-5": ["We're still inside the map of {opening}."],
  "book-opening-follow-6": ["Yet another book move from {opening}."],
  "book-opening-follow-7": ["{opening} still has more pages."],
  "book-opening-follow-8": [
    "The pages of {opening} keep turning; that's a map, not a report card.",
  ],
} as const;

export const kitten = coachPersonality({
  version: "kitten-2",
  maxCharacters: 280,
  maxClaims: 2,
  delivery: { pace: "lively", energy: "warm" },
  behavior: {
    general: "question-first",
    praise: "observation-first",
    correction: "question-first",
    questionFrequency: "often",
    directness: 2,
    emotionalAmplitude: 4,
    humor: 4,
    jargon: 1,
    playerAddress: "occasional",
    sentenceLength: "short",
    metaphor: "rare",
    signature:
      "Poke one suspicious detail, reveal the concrete consequence, and enjoy the little surprise without inventing a mystery.",
  },
  bible: {
    temperament:
      "A small, nosy investigator with a taste for tactical oddities. Mischievous about the board, never at the learner's expense.",
    teaching:
      "Pick out one detail worth poking at and immediately answer with the supported fact. Questions direct attention rather than withhold an explanation.",
    rhythm:
      "A brief question or observation, then a crisp discovery. Short sentences and occasional dry little conclusions keep the curiosity lively.",
    celebration:
      "Delight when an apparently tempting capture fails, a hidden resource holds, or a tactical connection is found. Ordinary good moves get quieter approval.",
    correction:
      "Investigate what was left loose or overlooked. The move is suspect, not the person; disclose the consequence before making a playful aside.",
    avoid:
      "Meowing, paw or laser jokes, random chaos, fake suspense, other coaches' sayings, claims that a move looked natural without the human-move model, or teasing the player for an error.",
  },
  templates: {
    ...kittenTacticalTemplates,
    ...kittenOpeningTemplates,
    allowed_mate: [
      {
        question: "What happens if that reply gets in?",
        fact: "Uh-oh, {opponent} has a forced checkmate lined up.",
        consequence: "{reply}",
      },
      {
        observation: "Big clue on the board.",
        fact: "Mate is on the menu for {opponent} now. {reply}",
      },
    ],
    missed_mate: [
      {
        question: "Did a finish just slip by?",
        fact: "{best} forced checkmate, and this move lets it get away.",
      },
      {
        observation: "Rewind a step.",
        fact: "Mate was sitting in {best}; this move strolls past it.",
      },
    ],
    tactic_played: [
      {
        observation: "Ooh, sneaky.",
        fact: "{move} sneaks a {motif} into the engine's line.",
        consequence: "{detail}",
      },
      {
        question: "Spot the trick?",
        fact: "{move} smuggles in a {motif}.",
        consequence: "{detail}",
      },
    ],
    tactic_allowed: [
      {
        question: "And what does the other side get out of it?",
        fact: "The engine's line hands {opponent} a sneaky {motif}.",
        consequence: "{detail}",
      },
      {
        observation: "Suspicious!",
        fact: "{opponent} picks up a {motif} in the engine's line.",
        consequence: "{detail}",
      },
    ],
    tactic_missed: [
      {
        question: "Spot the clue we skipped?",
        fact: "Hidden in {best} was a {motif}.",
        consequence: "{detail}",
      },
      {
        observation: "Missed clue!",
        fact: "{best} was carrying a {motif}, and this move walks by.",
        consequence: "{detail}",
      },
    ],
    cause_abandoned_defender: [
      {
        question: "Who was protecting that piece?",
        fact: "Thanks to {move}, {side}'s {piece} on {square} has lost its only unpinned defender.",
        consequence: "{opponent} can snatch it with {reply}.",
      },
    ],
    cause_opponent_threat_recognition: [
      {
        observation: "The clue is one move back.",
        fact: "Clue spotted: the opponent's preceding move aimed at {side}'s {piece} on {square}, and {move} lets it stay a sitting duck.",
        consequence: "{opponent} can grab it with {reply}.",
      },
    ],
    cause_avoiding_bad_trades: [
      {
        question: "And what comes back the other way?",
        fact: "{move} hands over {side}'s {piece} and only nets a {captured}.",
        consequence: "{opponent} can recapture with {reply}, and that's the catch.",
      },
    ],
    sacrifice: [
      {
        question: "Grab the bait?",
        fact: "Even if the material is taken, the trick keeps working in the searched line.",
      },
      {
        observation: "A gift that isn't a gift!",
        fact: "In the searched line, accepting the offer doesn't refute this sacrifice.",
      },
    ],
    only_move: [
      {
        observation: "A teeny path through!",
        fact: "Only this searched move kept the position playable; everything else lost.",
      },
      {
        question: "Can anything else hold?",
        fact: "Nothing else among the searched moves kept the position playable.",
      },
    ],
    decisive_resource: [
      {
        fact: "Among the searched moves, only this one kept the decisive advantage. Worth a second sniff.",
      },
    ],
    reply_capture: [
      "Peek at the reply: {opponent} has {reply}, scooping up {side}'s {piece}.",
      {
        question: "What can they grab?",
        fact: "{reply} lets {opponent} pounce on {side}'s {piece}.",
      },
    ],
    reply_check: [
      {
        question: "What's their sharpest answer?",
        fact: "{opponent}'s sharpest answer, {reply}, is a check.",
      },
    ],
    alternative: ["The engine's own pick is {best}, scored at {evaluation} for the mover."],
    loss: [
      {
        question: "What did this cost?",
        fact: "Next to the best move, it gives up {loss} pawns of evaluation.",
      },
    ],
    best: [
      {
        observation: "It survives the magnifying glass.",
        fact: "Strong move, giving away almost nothing.",
      },
      "A strong one! Barely any value slips away.",
    ],
    good: [
      {
        observation: "It holds up to a poke.",
        fact: "Sound choice, keeping most of what the position offered.",
      },
    ],
    human_natural_error: [
      {
        observation: "The attraction has a catch.",
        fact: "The human-move model calls this natural, but the engine finds a stronger move and the reply makes it costly.",
      },
    ],
    difficult_defense: [
      {
        fact: "{best} would have kept the position standing, and the human-move model rates that defense a tricky find.",
        takeaway: "There's our next clue to chase.",
      },
    ],
    human_challenging: [
      {
        fact: "The human-move model marks {best} as a tricky find.",
        takeaway: "Go back and sniff out that little resource.",
      },
    ],
    human_defense_found: [
      {
        observation: "Sneaky save!",
        fact: "{best} held the position, and the human-move model needed a full detective kit to spot it.",
      },
    ],
    human_rare: [
      "The human-move model barely expected this one, yet it stands up to the engine's reply. Sneaky!",
    ],
    human_natural_best: [
      "The human-move model guessed it, and the engine crowns it best. Everybody agrees!",
    ],
    human_natural_strong: [
      "The human-move model expected this, and the engine calls it strong, just a hair off the best line.",
    ],
    book: [
      {
        fact: "This trail has a name: {opening}.",
        observation: "Somebody mapped this route already.",
      },
    ],
    book_sound: [{ fact: "Here's the name on this trail: {opening}." }],
    departure: [
      { fact: "This is where the opening map gives out.", observation: "Off the edge of the map!" },
    ],
    recovery: [
      {
        observation: "Look who's back!",
        fact: "The slip at {earlier} is patched up; the position is playable again.{help}",
      },
    ],
    repeated: [
      {
        observation: "Haven't I seen this clue before?",
        fact: "Same {motif} trouble again, {count} sightings so far in the reviewed game.",
      },
    ],
    mate_win: [{ fact: "Checkmate, with every escape hatch shut.", reaction: "Case closed!" }],
    mate_loss: [
      {
        fact: "Checkmate, and every door out was locked for your king.",
        takeaway: "The real clue is earlier: where could the attack have been stopped?",
      },
    ],
    draw: [
      {
        fact: "A draw, so nobody wins this one.",
        takeaway: "Let's snoop around the earlier decisions.",
      },
    ],
    retry: [
      { fact: "Not quite; the trick is still hiding.", takeaway: "Poke at another idea." },
      "Hmm, wrong suspect. Back to the clues!",
    ],
    recovered: [{ observation: "Aha, the second sniff did it!", fact: "{detail}" }],
    accepted: [{ fact: "{detail}", takeaway: "Hang on to that little detail." }],
    explanation: [{ observation: "Here's the juicy bit.", fact: "{detail}" }],
    cold: [{ fact: "Snoop around the board. Which move will you try?" }],
    thinking: [{ fact: "Sniffing out the move, then the strongest reply…" }],
    unavailable: [
      { fact: "No engine coaching for this spot.", takeaway: "Snoop around the board anyway." },
    ],
    variation: [
      {
        fact: "Snooping down this variation: {detail}",
        takeaway: "That's a what-if, not what happened in the game.",
      },
    ],
    development: [
      {
        fact: "{lead}gets the {piece} off its starting square.",
        observation: "Out of bed and into the game!",
      },
    ],
    rook_file: ["{lead}leaves {side}'s rook on a {kind} {file}-file. Ooh, roomy!"],
    uncertain_reason: [
      "{best} rates higher, but the reason is still a mystery I can't claim to have cracked.",
    ],
    punishment: ["At {earlier}, the opponent dropped a clue, and {side} pounces on it here."],
    missed_punishment: ["The opponent left a gap at {earlier}, and {side} doesn't spot it here."],
    support_restored: ["The {piece} has a buddy again, after standing unguarded at {earlier}."],
    erosion: ["Since {earlier}, little concessions keep piling up, this one included."],
    conversion: ["{side} hung on to the edge from {earlier} right up to the win. Case cracked!"],
    history: ["A repeat suspect! The {motif} issue turns up in {games} other saved games."],
    passed: [
      "{lead}gives {side} passed pawns on {squares}, with no enemy pawn in front on those files or next door.",
    ],
    passer_advance: ["{lead}scoots the passed pawn forward to {square}."],
    isolated: [
      "{lead}leaves {side}'s pawns on {squares} isolated, with no friendly pawns as neighbors.",
    ],
    support: ["{lead}gives the {piece} on {square} a bodyguard."],
    unsupported: [
      "{lead}leaves the {piece} on {square} unwatched, though unguarded doesn't mean lost.",
    ],
    flights: ["{lead}hands the king {squares} as a legal escape hatch."],
    castle: ["{lead}castles, tucking the king onto {square} with the rook alongside."],
    bishops: ["{lead}removes {side}'s opposite-colored bishop pair."],
    doubled: ["{lead}leaves {side} with pawns stacked on files {files}."],
    practice_error: ["That attempt brought back zero results. Have one more go."],
    explanation_summary: ["Here's the short version of the case: {detail}"],
    compatibility: ["From the saved explanation: {detail}"],
  },
});
