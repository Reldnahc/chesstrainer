import type {CoachId} from "../../coach/model";
import type {CoachPersonality} from "../personality";
import {alien} from "./alien";
import {analyst} from "./analyst";
import {blonde} from "./blonde";
import {captain} from "./captain";
import {capybara} from "./capybara";
import {collie} from "./collie";
import {corgi} from "./corgi";
import {dragon} from "./dragon";
import {expert} from "./expert";
import {frog} from "./frog";
import {ghost} from "./ghost";
import {gorilla} from "./gorilla";
import {host} from "./host";
import {kitten} from "./kitten";
import {livingPawn} from "./livingPawn";
import {mushroom} from "./mushroom";
import {partner} from "./partner";
import {professor} from "./professor";
import {puppy} from "./puppy";
import {raccoon} from "./raccoon";
import {robot} from "./robot";
import {slime} from "./slime";
import {spark} from "./spark";
import {storyteller} from "./storyteller";
import {tuxedo} from "./tuxedo";
import {unicorn} from "./unicorn";
import {velvet} from "./velvet";
import {wizard} from "./wizard";
import {youngBoy} from "./youngBoy";
import {youngGirl} from "./youngGirl";

/** The one registration of every coach's personality, one file per coach. It must
 * cover every coach ID, and both coach catalogues read it, so a coach without a
 * personality is a type error rather than a neutral fallback. */
export const coachPersonalities = {
  classic: storyteller, "man-host": host, "man-expert": expert, "man-partner": partner,
  "woman-captain": captain, "woman-analyst": analyst, "woman-spark": spark, "woman-blonde": blonde,
  "cat-tuxedo": tuxedo, "cat-black": velvet, "dog-gentle": professor, "dog-corgi": corgi, "dog-collie": collie,
  "human-boy": youngBoy, "human-girl": youngGirl, "dog-puppy": puppy, "cat-kitten": kitten,
  alien, unicorn, gorilla, robot, wizard, slime, dragon, ghost, raccoon, frog, capybara,
  mushroom, "living-pawn": livingPawn,
} as const satisfies Record<CoachId, CoachPersonality>;
