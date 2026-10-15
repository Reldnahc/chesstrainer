import type {CoachId} from "../../coach/model";
import type {CoachPersonality} from "../personality";
import {youngBoy, youngGirl, puppy, kitten, gorilla, raccoon, frog, capybara, livingPawn} from "./grounded";
import {alien, unicorn, robot, wizard, slime, dragon, ghost, mushroom} from "./imagined";

// The cast catalog keys its entries by this table, so a cast coach without a
// personality is a type error rather than a neutral fallback.
export const newCastPersonalities = {
  "human-boy": youngBoy, "human-girl": youngGirl, "dog-puppy": puppy, "cat-kitten": kitten,
  alien, unicorn, gorilla, robot, wizard, slime, dragon, ghost, raccoon, frog, capybara,
  mushroom, "living-pawn": livingPawn,
} as const satisfies Partial<Record<CoachId, CoachPersonality>>;
