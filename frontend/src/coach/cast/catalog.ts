import type { ComponentType } from "react";
import { expressions, type CoachArtworkProps, type CoachCollection, type CoachGroup, type CoachId } from "../model";
import { newCastPersonalities } from "../../dialogue/characters/newCast";
import YoungBoyCoach from "./humansPets/YoungBoyCoach";
import YoungGirlCoach from "./humansPets/YoungGirlCoach";
import PuppyCoach from "./humansPets/PuppyCoach";
import KittenCoach from "./humansPets/KittenCoach";
import GorillaCoach from "./animals/GorillaCoach";
import RaccoonCoach from "./animals/RaccoonCoach";
import FrogCoach from "./animals/FrogCoach";
import CapybaraCoach from "./animals/CapybaraCoach";
import UnicornCoach from "./fantasy/UnicornCoach";
import WizardCoach from "./fantasy/WizardCoach";
import SlimeCoach from "./fantasy/SlimeCoach";
import DragonCoach from "./fantasy/DragonCoach";
import GhostCoach from "./fantasy/GhostCoach";
import MushroomCoach from "./fantasy/MushroomCoach";
import AlienCoach from "./scifi/AlienCoach";
import RobotCoach from "./scifi/RobotCoach";
import LivingPawnCoach from "./scifi/LivingPawnCoach";

type CastEntry = {
  id: CoachId;
  name: string;
  group: CoachGroup;
  description: string;
  character: string;
  Artwork: ComponentType<CoachArtworkProps>;
};

const cast: readonly CastEntry[] = [
  {
    id: "human-boy", name: "Milo", group: "humans", Artwork: YoungBoyCoach,
    description: "An excitable tactics kid who explains the discovery in plain language.",
    character: "Quick looks · eager lean · delighted double takes",
  },
  {
    id: "human-girl", name: "Cleo", group: "humans", Artwork: YoungGirlCoach,
    description: "A playful puzzle solver who finds the small clue that changes everything.",
    character: "Curious tilt · bright eyes · precise little nods",
  },
  {
    id: "dog-puppy", name: "Biscuit", group: "dogs", Artwork: PuppyCoach,
    description: "An eager teammate: warm reactions, one clear explanation and another chance.",
    character: "Soft ears · eager posture · delighted paws",
  },
  {
    id: "cat-kitten", name: "Pickle", group: "cats", Artwork: KittenCoach,
    description: "A tiny chaos detective, curious about normal-looking moves with hidden catches.",
    character: "Uneven ears · investigative glances · mischievous tilts",
  },
  {
    id: "gorilla", name: "Monty", group: "animals", Artwork: GorillaCoach,
    description: "A thoughtful heavyweight who makes the biggest concrete point simply.",
    character: "Grounded posture · deliberate gaze · quiet strength",
  },
  {
    id: "raccoon", name: "Bandit", group: "animals", Artwork: RaccoonCoach,
    description: "A practical opportunist with a sharp eye for whatever was left available.",
    character: "Searching eyes · nimble paws · alert posture",
  },
  {
    id: "frog", name: "Fergus", group: "animals", Artwork: FrogCoach,
    description: "One blunt fact, then silence. Astonishingly calm, even when the board is not.",
    character: "Slow lids · tiny breath · almost imperceptible dry glance",
  },
  {
    id: "capybara", name: "Winston", group: "animals", Artwork: CapybaraCoach,
    description: "Unshakeable calm: acknowledge the position honestly, then take the next step.",
    character: "Soft gaze · steady breathing · an unhurried reset",
  },
  {
    id: "unicorn", name: "Celeste", group: "fantasy", Artwork: UnicornCoach,
    description: "A graceful optimist who appreciates elegant ideas and explains why they work.",
    character: "Lifted gaze · flowing mane · graceful delight",
  },
  {
    id: "wizard", name: "Orin", group: "fantasy", Artwork: WizardCoach,
    description: "A patient scholar connecting supported patterns to a concrete lesson.",
    character: "Considered tilt · thoughtful eyes · a patient open hand",
  },
  {
    id: "dragon", name: "Ember", group: "fantasy", Artwork: DragonCoach,
    description: "A proud strategist with high standards and respect for precise defense.",
    character: "Steady stare · measured lift · contained power",
  },
  {
    id: "ghost", name: "Wisp", group: "fantasy", Artwork: GhostCoach,
    description: "A quiet watcher who notices a supported danger without dramatizing it.",
    character: "Watchful eyes · soft settling · a restrained turn",
  },
  {
    id: "alien", name: "Ziggy", group: "scifi", Artwork: AlienCoach,
    description: "A curious outsider studying the gap between human intuition and chess truth.",
    character: "Inquisitive gaze · asymmetric tilt · quiet fascination",
  },
  {
    id: "robot", name: "Rivet", group: "scifi", Artwork: RobotCoach,
    description: "Issue, cause, result. Literal, structured delivery with no invented precision.",
    character: "Lens scan · precise head increments · mechanical posture reset",
  },
  {
    id: "slime", name: "Pip", group: "conceptual", Artwork: SlimeCoach,
    description: "A happy little blob who teaches one concrete idea at a time.",
    character: "Soft squash · eager lean · a small delighted lift",
  },
  {
    id: "mushroom", name: "Button", group: "conceptual", Artwork: MushroomCoach,
    description: "An odd forest thinker with a gentle eye for support and structure.",
    character: "Cap tilt · soft settling · a curious glance",
  },
  {
    id: "living-pawn", name: "Percy", group: "conceptual", Artwork: LivingPawnCoach,
    description: "An earnest chess piece, deeply invested in every piece doing its job.",
    character: "Determined lean · proud gaze · a purposeful stance reset",
  },
];

export const newCoachCollections: readonly CoachCollection[] = cast.map((coach) => ({
  ...coach,
  defaultState: "neutral",
  expressions,
  fallbacks: {},
  defaultFamily: coach.id,
  capabilities: { reactions: true, idle: true },
  animation: {
    defaultReactionMs: 1400,
    reactionMs: { brilliant: 1700, blunder: 1850, winning: 1700, losing: 1500 },
    defaultIdle: ["blink", "glance", "breathe", "nod"],
    idleGestures: {},
  },
  families: [{
    id: coach.id,
    coachId: coach.id,
    name: coach.name,
    description: coach.description,
    character: coach.character,
    personality: newCastPersonalities[coach.id],
  }],
}));
