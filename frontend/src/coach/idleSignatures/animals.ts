import { track } from "../idleModel";
import { signature } from "./signature";
import { attentive, positive, type SignatureCollection } from "./types";

// Paw performances move the complete forelimb about its shoulder. Restrict
// these to free-hand poses so a held book never separates from its support.
const freePaws = ["neutral", "idle", "great", "best", "good", "encouraging", "recovered", "explaining", "draw"] as const;
const pawsAtRest = ["neutral", "idle", "good"] as const;
const observing = [...attentive, "best", "check", "inaccuracy"] as const;

export const animalSignatures = {
  "dog-gentle": [
    signature("signature-a", "detail", "Listening, one ear at a time",
      "The first soft ear listens; the second catches up as the head inclines.",
      observing, [
        track("leftEar", "animal-professor-listen", 1400),
        track("rightEar", "animal-professor-answer", 1200, 240),
        track("head", "animal-professor-incline", 1500),
    ], { cooldownMs: 10_000, weight: 0.8 }),
    signature("signature-b", "attention", "A reassuring little nod",
      "A gentle dip, a smaller afterthought, and one quiet tail punctuation.",
      positive, [
        track("head", "animal-professor-assurance", 1500),
        track("tail", "animal-professor-tail", 1150, 300),
        track("eyes", "animal-professor-blink", 900, 550),
    ], { cooldownMs: 12_000, weight: 0.75, blink: true }),
  ],
  "dog-corgi": [
    signature("signature-a", "body", "Stand to attention",
      "A compact gather, a proud chest lift, and ears coming neatly to attention.",
      positive, [
        track("body", "animal-corgi-attention", 1300),
        track("head", "animal-corgi-chin", 1000, 180),
        track("leftEar", "animal-corgi-prick", 850, 260),
        track("rightEar", "animal-corgi-prick", 850, 340),
    ], { cooldownMs: 9500, weight: 0.9 }),
    signature("signature-b", "detail", "One ear on you",
      "One pointed ear asks first; the other answers after a sidelong glance.",
      [...observing, "mistake", "missed"], [
        track("leftEar", "animal-corgi-question", 1450),
        track("rightEar", "animal-corgi-reply", 1050, 390),
        track("gaze", "animal-corgi-side-eye", 1300, 120),
    ], { cooldownMs: 11_000, weight: 0.8 }),
  ],
  "dog-collie": [
    signature("signature-a", "attention", "Track the line",
      "Three deliberate fixations, with the head and each listening ear following in order.",
      [...observing, "missed"], [
        track("gaze", "animal-collie-three-points", 1650),
        track("head", "animal-collie-follow", 1450, 150),
        track("leftEar", "animal-collie-locate", 800, 120),
        track("rightEar", "animal-collie-locate", 800, 650),
    ], { cooldownMs: 10_000, weight: 0.85 }),
    signature("signature-b", "body", "Ready at the edge",
      "A purposeful paw adjustment and a small countershift of weight, ready for the next idea.",
      freePaws, [
        track("leftPaw", "animal-collie-paw-left", 1300),
        track("rightPaw", "animal-collie-paw-right", 1150, 180),
        track("body", "animal-collie-balance", 1450),
    ], { cooldownMs: 11_500, weight: 0.75 }),
  ],
  "dog-puppy": [
    signature("signature-a", "attention", "Did you see that?",
      "An eager little head lift; the floppy ears catch up one after the other.",
      positive, [
        track("head", "animal-puppy-perk", 1350),
        track("leftEar", "animal-puppy-ear-first", 1250, 90),
        track("rightEar", "animal-puppy-ear-late", 1000, 330),
    ], { cooldownMs: 9500, weight: 0.9 }),
    signature("signature-b", "body", "Paws first, tail second",
      "Two small paw adjustments finish with a single loose tail sweep.",
      freePaws, [
        track("leftPaw", "animal-puppy-shuffle", 1000),
        track("rightPaw", "animal-puppy-shuffle-right", 1000, 270),
        track("tail", "animal-puppy-tail-answer", 950, 400),
    ], { cooldownMs: 11_000, weight: 0.8 }),
  ],
  "cat-tuxedo": [
    signature("signature-a", "attention", "A second look",
      "A long, deliberate look to the side, punctuated by two restrained tail beats.",
      attentive, [
        track("gaze", "animal-tuxedo-reconsider", 1750),
        track("tail", "animal-tuxedo-punctuation", 1300, 350),
        track("head", "animal-tuxedo-reserve", 1500, 200),
    ], { cooldownMs: 12_000, weight: 0.75 }),
    signature("signature-b", "detail", "One raised ear",
      "One ear turns, the head answers the other way, and a measured blink closes the thought.",
      ["neutral", "idle", "best", "thinking", "uncertain", "inaccuracy", "mistake", "explaining", "draw"], [
        track("leftEar", "animal-tuxedo-skeptic", 1450),
        track("eyes", "animal-tuxedo-appraise", 1200, 180),
        track("head", "animal-tuxedo-countertilt", 1450),
    ], { cooldownMs: 11_000, weight: 0.8, blink: true }),
  ],
  "cat-black": [
    signature("signature-a", "eyes", "Quiet reassurance",
      "An unhurried blink opens in two stages while one ear settles softly.",
      [...attentive, "good", "encouraging", "mistake", "losing", "recovered"], [
        track("eyes", "animal-velvet-soft-blink", 1550),
        track("rightEar", "animal-velvet-ear-settle", 1050, 420),
    ], { cooldownMs: 10_500, weight: 0.85, blink: true, intensity: "quiet" }),
    signature("signature-b", "body", "A tucked paw",
      "A paw folds inward, the other steadies, and the tail draws close for a moment.",
      pawsAtRest, [
        track("leftPaw", "animal-velvet-tuck", 1600),
        track("rightPaw", "animal-velvet-counterpaw", 1350, 200),
        track("tail", "animal-velvet-curl", 1450, 180),
    ], { cooldownMs: 13_000, weight: 0.75 }),
  ],
  "cat-kitten": [
    signature("signature-a", "attention", "Where did it go?",
      "A quick look one way, an upward look the other, and two uneven listening ears.",
      [...attentive, "best", "great"], [
        track("gaze", "animal-kitten-investigate", 1350),
        track("head", "animal-kitten-follow", 1250, 100),
        track("leftEar", "animal-kitten-catch", 750, 70),
        track("rightEar", "animal-kitten-catch", 750, 420),
    ], { cooldownMs: 9500, weight: 0.9 }),
    signature("signature-b", "body", "Testing the edge",
      "An exploratory paw reaches, hesitates, then makes a smaller second try under a watchful gaze.",
      ["neutral", "idle", "good", "best", "explaining"], [
        track("rightPaw", "animal-kitten-test-paw", 1550),
        track("gaze", "animal-kitten-watch-paw", 1450),
        track("head", "animal-kitten-anticipate", 1500),
    ], { cooldownMs: 11_000, weight: 0.8 }),
  ],
  gorilla: [
    signature("signature-a", "body", "Settle the shoulders",
      "A grounded weight shift lets both heavy forearms ease out and come quietly to rest.",
      freePaws, [
        track("body", "animal-gorilla-ground", 1650),
        track("leftPaw", "animal-gorilla-open-left", 1400, 120),
        track("rightPaw", "animal-gorilla-open-right", 1400, 220),
    ], { cooldownMs: 12_000, weight: 0.7 }),
    signature("signature-b", "attention", "Measured consideration",
      "The eyes consider first, a deliberate nod follows, and one hand resets its weight.",
      [...freePaws, "inaccuracy", "mistake", "losing"], [
        track("gaze", "animal-gorilla-consider", 1650),
        track("head", "animal-gorilla-acknowledge", 1550, 90),
        track("leftPaw", "animal-gorilla-knuckle-reset", 1100, 450),
    ], { cooldownMs: 12_000, weight: 0.75 }),
  ],
  raccoon: [
    signature("signature-a", "body", "Inventory check",
      "Nimble hands turn in sequence while the eyes check one side, then the other.",
      freePaws, [
        track("rightPaw", "animal-raccoon-inspect", 1500),
        track("leftPaw", "animal-raccoon-counterhand", 1200, 240),
        track("gaze", "animal-raccoon-inventory", 1500),
    ], { cooldownMs: 10_500, weight: 0.85 }),
    signature("signature-b", "attention", "Something over there",
      "A peripheral glance pulls the head after it; one ear checks twice before both relax.",
      observing, [
        track("gaze", "animal-raccoon-notice", 1450),
        track("head", "animal-raccoon-follow", 1200, 180),
        track("leftEar", "animal-raccoon-double-ear", 1000),
        track("rightEar", "animal-raccoon-listen", 1050, 300),
        track("whiskers", "animal-raccoon-whiskers", 850, 420),
    ], { cooldownMs: 11_000, weight: 0.8 }),
  ],
  frog: [
    signature("signature-a", "body", "A breath, eventually",
      "The throat swells gently and holds; a late blink takes its time reopening.",
      [...attentive, "good", "mistake", "losing", "encouraging"], [
        track("throat", "animal-frog-long-breath", 1750),
        track("eyes", "animal-frog-unhurried-lids", 1050, 650),
    ], { cooldownMs: 11_500, weight: 0.9, blink: true, intensity: "quiet" }),
    signature("signature-b", "attention", "The smallest double take",
      "The eyes move first. A tiny head adjustment arrives late, then thinks better of it.",
      observing, [
        track("gaze", "animal-frog-dry-glance", 1500),
        track("head", "animal-frog-small-reconsider", 1450, 50),
    ], { cooldownMs: 11_000, weight: 0.85 }),
  ],
  capybara: [
    signature("signature-a", "detail", "Nothing urgent",
      "Two small ears respond at different speeds, with a calm, almost imperceptible settling of the head.",
      [...attentive, "good", "mistake", "losing", "encouraging"], [
        track("leftEar", "animal-capybara-ear-left", 1450),
        track("rightEar", "animal-capybara-ear-right", 1200, 300),
        track("head", "animal-capybara-soften", 1600),
    ], { cooldownMs: 12_000, weight: 0.8, intensity: "quiet" }),
    signature("signature-b", "body", "Make yourself comfortable",
      "A slow shift of weight settles into a small blink and a soft release of the whiskers.",
      [...attentive, "good", "inaccuracy", "mistake", "losing", "encouraging", "recovered"], [
        track("body", "animal-capybara-comfort", 1750),
        track("eyes", "animal-capybara-late-blink", 1100, 520),
        track("whiskers", "animal-capybara-release", 1150, 400),
    ], { cooldownMs: 12_500, weight: 0.75, blink: true }),
  ],
} satisfies SignatureCollection;
