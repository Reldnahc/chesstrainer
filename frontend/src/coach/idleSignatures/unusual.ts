import { gesture, track, type IdleGesture, type IdleTrack } from "../idleModel";
import type { CoachExpression } from "../model";
import { attentive, concerned, positive, type SignatureCollection, type SignatureGesture } from "./types";
import { scifiSignatures } from "./scifi";

function signature(
  id: SignatureGesture["id"],
  group: IdleGesture["group"],
  label: string,
  description: string,
  expressions: readonly CoachExpression[],
  tracks: readonly IdleTrack[],
  blink = false,
): SignatureGesture {
  return {
    ...gesture(id, group, tracks, { cooldownMs: 5600, weight: 1.15, blink }),
    id, label, description, expressions,
  };
}

const calm = [...new Set([...attentive, ...positive])] as readonly CoachExpression[];
const watchful = [...new Set([...attentive, ...concerned])] as readonly CoachExpression[];

export const unusualSignatures = {
  ...scifiSignatures,
  unicorn: [
    signature("signature-a", "detail", "Silken turn",
      "Celeste turns gracefully; her mane catches up, drapes, then settles.", calm, [
        track("head", "unusual-unicorn-turn", 1350),
        track("hair", "unusual-mane-follow", 1400, 140),
      ]),
    signature("signature-b", "attention", "A listening ear",
      "One ear listens, the second answers, and her muzzle lifts a little.", watchful, [
        track("leftEar", "unusual-unicorn-listen", 1050),
        track("rightEar", "unusual-unicorn-answer", 1100, 240),
        track("head", "unusual-muzzle-lift", 1500),
      ]),
  ],
  wizard: [
    signature("signature-a", "attention", "Over the spectacles",
      "Orin lowers his chin, peers over his glasses and brings his gaze back into focus.", watchful, [
        track("head", "unusual-scholar-peer", 1450),
        track("glasses", "unusual-rims-settle", 1150, 120),
        track("gaze", "unusual-scholar-refocus", 1400),
      ]),
    signature("signature-b", "detail", "Scholar's settle",
      "His shoulders release, one sleeve relaxes, and the beard follows after a soft pause.",
      ["neutral", "idle", "good", "encouraging", "draw"], [
        track("body", "unusual-scholar-shoulders", 1550),
        track("leftArm", "unusual-sleeve-settle", 1300, 100),
        track("hem", "unusual-beard-follow", 1450, 220),
      ]),
  ],
  dragon: [
    signature("signature-a", "detail", "Fold the wings",
      "Ember draws his wings in, pauses, then lets them unfurl only enough to relax.",
      [...attentive, "good", "encouraging", "mistake", "losing"], [
        track("wings", "unusual-wing-fold", 1550),
        track("body", "unusual-dragon-anchor", 1500),
      ]),
    signature("signature-b", "attention", "Track the horizon",
      "His eyes pick up a detail; the horn line follows, with one ear answering the other.", watchful, [
        track("gaze", "unusual-dragon-watch", 1650),
        track("head", "unusual-dragon-turn", 1450, 100),
        track("leftEar", "unusual-dragon-ear", 1000, 180),
        track("rightEar", "unusual-dragon-ear", 1000, 420),
      ]),
  ],
  ghost: [
    signature("signature-a", "body", "Suspended thought",
      "Wisp rises gently and settles while the lower silhouette trails behind.", watchful, [
        track("head", "unusual-ghost-float", 1700),
        track("hem", "unusual-ghost-trail", 1450, 220),
      ]),
    signature("signature-b", "attention", "Curious drift",
      "A sideways drift leads the gaze; the hem leans back before everything comes to rest.", calm, [
        track("head", "unusual-ghost-drift", 1650),
        track("gaze", "unusual-ghost-look", 1400, 160),
        track("hem", "unusual-ghost-counterflow", 1500, 100),
      ]),
  ],
  slime: [
    signature("signature-a", "body", "Slow ripple",
      "Pip shifts weight from one side to the other; the eyes and lower ripple catch up separately.", watchful, [
        track("head", "unusual-slime-transfer", 1750),
        track("gaze", "unusual-slime-refocus", 1400, 200),
        track("hem", "unusual-slime-ripple", 1550, 100),
      ]),
    signature("signature-b", "body", "Soft rebound",
      "A small squash releases into a slower rebound with one last ripple along the base.",
      positive, [
        track("head", "unusual-slime-rebound", 1600),
        track("hem", "unusual-slime-afterwave", 1400, 180),
      ]),
  ],
  mushroom: [
    signature("signature-a", "detail", "Cap settles",
      "Button's cap dips, wobbles once, and settles as the eyes close and reopen softly.", watchful, [
        track("cap", "unusual-cap-settle", 1550),
        track("eyes", "unusual-mushroom-blink", 1050, 180),
      ], true),
    signature("signature-b", "attention", "Under the brim",
      "The stem leans curiously; a late tilt of the cap follows the eyes back to the board.", calm, [
        track("head", "unusual-stem-lean", 1550),
        track("cap", "unusual-cap-follow", 1350, 180),
        track("gaze", "unusual-mushroom-look", 1350),
      ]),
  ],
} satisfies SignatureCollection;
