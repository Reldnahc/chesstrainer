import type { CoachExpression } from "../model";
import type { Score } from "../../evaluation";

export const examples: Record<
  CoachExpression,
  { title: string; text: string; evaluation: Score | null }
> = {
  neutral: {
    title: "Your move",
    text: "Take your time. Look for the opponent's threat before choosing your move.",
    evaluation: { kind: "cp", value: 20, mate_given: false },
  },
  idle: {
    title: "I'm here when you're ready",
    text: "Try an idea on the board. We can look at the reply together.",
    evaluation: { kind: "cp", value: 20, mate_given: false },
  },
  brilliant: {
    title: "Nf6+ is brilliant",
    text: "You found the sacrifice. Taking your knight opens the file for a winning attack.",
    evaluation: { kind: "cp", value: 435, mate_given: false },
  },
  great: {
    title: "Rc1 is great",
    text: "Only this move keeps your advantage. You stopped the threat and kept the pressure.",
    evaluation: { kind: "cp", value: 240, mate_given: false },
  },
  best: {
    title: "Qe4 is best",
    text: "You improved your queen while keeping the bishop protected.",
    evaluation: { kind: "cp", value: 125, mate_given: false },
  },
  good: {
    title: "Nf3 is good",
    text: "A sound developing move. Your knight controls the center.",
    evaluation: { kind: "cp", value: 35, mate_given: false },
  },
  book: {
    title: "Bb5 is book",
    text: "This is the Ruy Lopez. Your bishop puts pressure on the knight defending e5.",
    evaluation: { kind: "cp", value: 30, mate_given: false },
  },
  inaccuracy: {
    title: "a3 is an inaccuracy",
    text: "You had time to develop a piece. This lets your opponent catch up.",
    evaluation: { kind: "cp", value: 10, mate_given: false },
  },
  mistake: {
    title: "Bd3 is a mistake",
    text: "Your bishop is pinned to the queen. The next pawn push wins it.",
    evaluation: { kind: "cp", value: -220, mate_given: false },
  },
  blunder: {
    title: "Qh5 is a blunder",
    text: "That knight move comes with check—and attacks your queen. You can't save both.",
    evaluation: { kind: "cp", value: -740, mate_given: false },
  },
  missed: {
    title: "Re1 misses a chance",
    text: "You could have forked the king and rook. That opportunity is gone now.",
    evaluation: { kind: "cp", value: 45, mate_given: false },
  },
  check: {
    title: "Bb5+ gives check",
    text: "The king must respond. Notice which escape squares your other pieces control.",
    evaluation: { kind: "cp", value: 170, mate_given: false },
  },
  winning: {
    title: "Qh7# · Checkmate",
    text: "Your queen and bishop work together. The king has no safe square.",
    evaluation: { kind: "mate", value: 0, mate_given: true },
  },
  losing: {
    title: "Qh4# · Checkmate",
    text: "The king has no escape. Let's go back and find where you could have stopped the attack.",
    evaluation: { kind: "mate", value: 0, mate_given: false },
  },
  thinking: {
    title: "Let's look at the reply",
    text: "I'm checking this move and the opponent's strongest response…",
    evaluation: null,
  },
  uncertain: {
    title: "Let's take another look",
    text: "I don't have a reliable answer for this position yet. You can still explore the board.",
    evaluation: null,
  },
  encouraging: {
    title: "You've got another try",
    text: "Look at the piece that just moved. What did it leave unprotected?",
    evaluation: null,
  },
  recovered: {
    title: "That's the idea",
    text: "You found it. Spotting the threat after a miss is how the pattern sticks.",
    evaluation: { kind: "cp", value: 250, mate_given: false },
  },
  explaining: {
    title: "Watch the defender",
    text: "The rook is doing two jobs. Move it away and the back rank becomes vulnerable.",
    evaluation: { kind: "cp", value: 315, mate_given: false },
  },
  draw: {
    title: "A drawn position",
    text: "Neither side can make progress here. Sometimes holding the balance is the achievement.",
    evaluation: { kind: "cp", value: 0, mate_given: false },
  },
};
