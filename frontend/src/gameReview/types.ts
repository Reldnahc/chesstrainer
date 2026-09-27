import type { LegalMove } from "../api";
import type { Score } from "../evaluation";

export type Candidate = {
  uci: string;
  san: string;
  pv: string[];
  score: Score;
};
export type Report = {
  label: string;
  reason: string;
  coach: string;
  best: Candidate;
  actual: Candidate;
  white_score: Score;
  depth: number;
  engine_version: string;
  board_cues?: {
    fen: string;
    caption: string;
    roles: Record<string, string[]>;
    arrows: {
      startSquare: string;
      endSquare: string;
      kind: "move" | "reply" | "threat";
    }[];
  } | null;
};
export type Position = {
  fen: string;
  legal_moves: LegalMove[];
  turn: "white" | "black";
  result: string | null;
  termination: string | null;
  san: string;
};
export type Frame = Position & {
  uci: string | null;
  number: number;
  actor: "white" | "black" | null;
  report: Report | null;
};
export type Accuracy = { version: string; white: number; black: number };
export type Game = {
  id: string;
  white: string;
  black: string;
  played_on: string | null;
  result: string;
  orientation: "white" | "black";
  rating: number;
  white_rating: number | null;
  black_rating: number | null;
  frames: Frame[];
  job: {
    id: string;
    status: string;
    completed: number;
    total: number;
    error: string | null;
    cancel_requested: boolean;
  } | null;
  accuracy: Accuracy | null;
};
export type ReviewProgress = {
  job: Game["job"];
  accuracy: Accuracy | null;
  moves: { ply: number; report: Report }[];
};
export type Branch = {
  id: number;
  root: number;
  moves: string[];
  sans: string[];
  returnPly: number;
};
export type Cursor = { ply: number; branch: number | null; step: number };
export type Analysis = {
  report: Report | null;
  score: Score | null;
  best_move: string | null;
};
