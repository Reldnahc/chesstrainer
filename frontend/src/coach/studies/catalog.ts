import { expressions, type CoachDefinition } from "../model";
import { coaches } from "../registry";
import ManCoach from "./ManCoach";
import WomanCoach from "./WomanCoach";
import CatCoach from "./CatCoach";
import RetrieverCoach from "./RetrieverCoach";

const animalPerformance: CoachDefinition["animation"] = {
  defaultReactionMs: 1400,
  reactionMs: { brilliant: 1700, blunder: 1850, winning: 1700, losing: 1500 },
  idleRangeMs: [5500, 11500],
  defaultIdle: ["blink", "glance", "breathe", "ears"],
  idleGestures: {
    brilliant: ["blink", "tail", "twinkle"],
    blunder: ["blink", "sigh", "ears"],
    thinking: ["glance", "blink", "ears"],
    uncertain: ["glance", "ears"],
    losing: ["blink", "breathe"],
    mistake: ["blink", "sigh"],
    great: ["blink", "tail", "nod"],
    good: ["blink", "nod", "tail"],
    winning: ["blink", "tail", "twinkle"],
    book: ["glance", "blink"],
    encouraging: ["blink", "nod"],
    recovered: ["blink", "tail"],
  },
};
const animalIntents: CoachDefinition["expressionIntents"] = {
  neutral: "An attentive gaze and a relaxed, welcoming posture.",
  brilliant:
    "A delighted double take. Bright eyes, lifted paws and an eager tail.",
  great: "An approving nod, an offered paw and a little tail movement.",
  best: "Focused eyes and a confident paw: that is the move.",
  good: "Soft, closed eyes and an easy smile.",
  book: "Eyes down, paws around the book. Familiar territory.",
  inaccuracy: "A questioning tilt and one ear listening a little harder.",
  mistake: "Ears soften and the eyes close briefly. A sympathetic wince.",
  blunder:
    "Wide eyes, startled paws and ears drawn back. Concern, never ridicule.",
  missed: "A glance back and an offered paw: the opportunity was there.",
  losing: "Lowered ears, a tucked tail and a gentle, concerned face.",
  thinking: "One paw at the muzzle; the eyes track an idea.",
  uncertain: "Uneven ears and a curious tilt. Still figuring it out.",
  encouraging: "A soft gaze and a welcoming paw. There is another chance.",
  recovered: "A happy squint, a lifted paw and a short tail celebration.",
  explaining: "An open paw offers the idea, with eyes following the board.",
  draw: "A small, balanced paw gesture and an accepting smile.",
};
const common = {
  defaultState: "neutral",
  expressions,
  fallbacks: {},
  capabilities: { reactions: true, idle: true },
} as const;

export const manStudy: CoachDefinition = {
  ...coaches.classic,
  name: "Men",
  description:
    "Storyteller and three new faces, each with a distinct silhouette and wardrobe.",
  animation: {
    ...coaches.classic.animation,
    idleGestures: {
      ...coaches.classic.animation.idleGestures,
      blunder: ["blink", "sigh"],
      thinking: ["glance", "blink"],
    },
  },
  families: [
    coaches.classic.families[0],
    {
      id: "host",
      name: "Club host",
      description:
        "Close curls, a neat beard and a terracotta overshirt. An easy, welcoming presence.",
      character: "Open palms · warm grins · an expressive double take",
    },
    {
      id: "expert",
      name: "Endgame expert",
      description:
        "Silver at the temples, a clean-shaven face and a slate cardigan. A steady study companion.",
      character: "Measured tilts · attentive eyes · quiet delight",
    },
    {
      id: "partner",
      name: "Creative partner",
      description:
        "Dark waves, a shaped beard and a forest-green waistcoat. Ready to explore an idea together.",
      character: "Curious looks · bright smiles · generous encouragement",
    },
  ],
  Artwork: ManCoach,
};

export const womanStudy: CoachDefinition = {
  ...common,
  id: "woman",
  name: "Woman",
  defaultFamily: "captain",
  description:
    "Three women with distinct silhouettes, wardrobes and ways of encouraging a player.",
  expressionIntents: {
    brilliant: "A delighted double take, then a bright, open smile.",
    best: "Quiet conviction. Exactly the move she was hoping for.",
    thinking: "Eyes follow an idea, with one hand at her chin.",
  },
  animation: {
    ...animalPerformance,
    defaultIdle: ["blink", "glance", "breathe", "hair"],
    idleGestures: {
      brilliant: ["blink", "twinkle", "nod"],
      blunder: ["blink", "sigh", "hair"],
      thinking: ["glance", "blink", "hair"],
      good: ["blink", "nod"],
      winning: ["blink", "twinkle"],
      losing: ["blink", "breathe"],
      encouraging: ["blink", "nod"],
    },
  },
  families: [
    {
      id: "captain",
      name: "Club captain",
      description:
        "Auburn waves, a teal blazer and warm, assured encouragement.",
      character: "Open hands · generous smiles · confident nods",
    },
    {
      id: "analyst",
      name: "Quiet analyst",
      description:
        "A curled updo, warm cream knitwear and thoughtful eyes behind glasses.",
      character: "Small tilts · considered pauses · a reassuring smile",
    },
    {
      id: "spark",
      name: "Bright spark",
      description:
        "A swinging ponytail and a plum jacket. Quick to spot—and celebrate—an idea.",
      character: "Anticipation · lively poses · hair follow-through",
    },
  ],
  Artwork: WomanCoach,
};

export const catStudy: CoachDefinition = {
  ...common,
  id: "cat",
  name: "Cat",
  defaultFamily: "tabby",
  description:
    "Three feline coaches, with expressive ears, whiskers and very deliberate paws.",
  expressionIntents: animalIntents,
  animation: animalPerformance,
  families: [
    {
      id: "tabby",
      name: "Library tabby",
      description:
        "A warm ginger study companion. Curious eyes, soft stripes and a sage scarf.",
      character: "Ear flicks · thoughtful paws · a pleased little squint",
    },
    {
      id: "tuxedo",
      name: "Midnight tactician",
      description:
        "A sharp tuxedo silhouette, white mittens and a quieter kind of confidence.",
      character: "Measured looks · precise nods · slow tail punctuation",
    },
    {
      id: "calico",
      name: "Curious calico",
      description:
        "A patchwork face with a turquoise scarf. Always another angle to investigate.",
      character: "Uneven ears · playful head tilts · bright double takes",
    },
  ],
  Artwork: CatCoach,
};

export const retrieverStudy: CoachDefinition = {
  ...common,
  id: "retriever",
  name: "Golden retriever",
  defaultFamily: "sunny",
  description:
    "Three unmistakably golden companions: floppy ears, feathered tails and patient enthusiasm.",
  expressionIntents: animalIntents,
  animation: { ...animalPerformance, idleRangeMs: [6000, 12000] },
  families: [
    {
      id: "sunny",
      name: "Sunny companion",
      description:
        "Honey-gold fur and a blue bandana. Every good idea earns a warm welcome.",
      character: "Bright eyes · soft ear bounce · a happy tail",
    },
    {
      id: "gentle",
      name: "Gentle professor",
      description:
        "A cream-colored older golden with reading glasses and endless patience.",
      character: "Soft brows · unhurried nods · gentle encouragement",
    },
    {
      id: "scout",
      name: "Trail buddy",
      description:
        "A red-gold coat, a green scarf and an alert, adventurous streak.",
      character: "Perked attention · quick recovery · feathery follow-through",
    },
  ],
  Artwork: RetrieverCoach,
};

// These assets are imported only by the lazy studio route. Promotion to Settings
// is a separate product choice and uses the existing typed production registry.
export const coachStudies = [manStudy, womanStudy, catStudy, retrieverStudy];
export function getCoachStudy(id: string | null | undefined) {
  return coachStudies.find((coach) => coach.id === id) ?? manStudy;
}
