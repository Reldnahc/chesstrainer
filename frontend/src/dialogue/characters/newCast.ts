import type {CoachPersonality} from "../personality";
import {youngBoy, youngGirl, puppy, kitten, gorilla, raccoon, frog, capybara, livingPawn} from "./grounded";
import {alien, unicorn, robot, wizard, slime, dragon, ghost, mushroom} from "./imagined";

export const newCastPersonalities: Readonly<Record<string, CoachPersonality>> = {
  "human-boy": youngBoy, "human-girl": youngGirl, "dog-puppy": puppy, "cat-kitten": kitten,
  alien, unicorn, gorilla, robot, wizard, slime, dragon, ghost, raccoon, frog, capybara,
  mushroom, "living-pawn": livingPawn,
};
