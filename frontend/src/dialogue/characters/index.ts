import type { CoachId } from "../../coach/model";
import type { CoachPersonality } from "../personality";
import { alien } from "./alien";
import { analyst } from "./analyst";
import { black } from "./black";
import { blonde } from "./blonde";
import { boy } from "./boy";
import { captain } from "./captain";
import { capybara } from "./capybara";
import { classic } from "./classic";
import { collie } from "./collie";
import { corgi } from "./corgi";
import { dragon } from "./dragon";
import { expert } from "./expert";
import { frog } from "./frog";
import { gentle } from "./gentle";
import { ghost } from "./ghost";
import { girl } from "./girl";
import { gorilla } from "./gorilla";
import { host } from "./host";
import { kitten } from "./kitten";
import { livingPawn } from "./livingPawn";
import { mushroom } from "./mushroom";
import { partner } from "./partner";
import { puppy } from "./puppy";
import { raccoon } from "./raccoon";
import { robot } from "./robot";
import { slime } from "./slime";
import { spark } from "./spark";
import { tuxedo } from "./tuxedo";
import { unicorn } from "./unicorn";
import { wizard } from "./wizard";

/** The one registration of every coach's personality, one file per coach. It must
 * cover every coach ID, and both coach catalogues read it, so a coach without a
 * personality is a type error rather than a neutral fallback. */
export const coachPersonalities = {
  classic,
  "man-host": host,
  "man-expert": expert,
  "man-partner": partner,
  "woman-captain": captain,
  "woman-analyst": analyst,
  "woman-spark": spark,
  "woman-blonde": blonde,
  "cat-tuxedo": tuxedo,
  "cat-black": black,
  "dog-gentle": gentle,
  "dog-corgi": corgi,
  "dog-collie": collie,
  "human-boy": boy,
  "human-girl": girl,
  "dog-puppy": puppy,
  "cat-kitten": kitten,
  alien,
  unicorn,
  gorilla,
  robot,
  wizard,
  slime,
  dragon,
  ghost,
  raccoon,
  frog,
  capybara,
  mushroom,
  "living-pawn": livingPawn,
} as const satisfies Record<CoachId, CoachPersonality>;
