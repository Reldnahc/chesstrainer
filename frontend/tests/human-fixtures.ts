import {semanticFixtures} from "./semantic-fixtures";
import {gameIntent} from "../src/dialogue/gameIntent";
import type {Game} from "../src/gameReview/types";

export const humanGames = semanticFixtures<Record<string, Game>>("review_human_fixtures.py");
// The intent the Maia badge and popup are built from; the coach's own never has Maia.
export function humanIntent(game: Game) {
  return gameIntent({game, frame: game.frames[1], report: game.frames[1].report,
    ply: 1, key: game.id, expression: "best", human: true});
}
