import type { CoachExpression } from "../model";

export const examples: Record<
  CoachExpression,
  { title: string; text: string; evaluation: string }
> = {
  neutral: {
    title: "Your move",
    text: "Take your time. Look for the opponent's threat before choosing your move.",
    evaluation: "+0.20",
  },
  idle: {
    title: "I'm here when you're ready",
    text: "Try an idea on the board. We can look at the reply together.",
    evaluation: "+0.20",
  },
  brilliant: {
    title: "Nf6+ is brilliant",
    text: "You found the sacrifice. Taking your knight opens the file for a winning attack.",
    evaluation: "+4.35",
  },
  great: {
    title: "Rc1 is great",
    text: "Only this move keeps your advantage. You stopped the threat and kept the pressure.",
    evaluation: "+2.40",
  },
  best: {
    title: "Qe4 is best",
    text: "You improved your queen while keeping the bishop protected.",
    evaluation: "+1.25",
  },
  good: {
    title: "Nf3 is good",
    text: "A sound developing move. Your knight controls the center.",
    evaluation: "+0.35",
  },
  book: {
    title: "Bb5 is book",
    text: "This is the Ruy Lopez. Your bishop puts pressure on the knight defending e5.",
    evaluation: "+0.30",
  },
  inaccuracy: {
    title: "a3 is an inaccuracy",
    text: "You had time to develop a piece. This lets your opponent catch up.",
    evaluation: "+0.10",
  },
  mistake: {
    title: "Bd3 is a mistake",
    text: "Your bishop is pinned to the queen. The next pawn push wins it.",
    evaluation: "−2.20",
  },
  blunder: {
    title: "Qh5 is a blunder",
    text: "That knight move comes with check—and attacks your queen. You can't save both.",
    evaluation: "−7.40",
  },
  missed: {
    title: "Re1 misses a chance",
    text: "You could have forked the king and rook. That opportunity is gone now.",
    evaluation: "+0.45",
  },
  check: {
    title: "Bb5+ gives check",
    text: "The king must respond. Notice which escape squares your other pieces control.",
    evaluation: "+1.70",
  },
  winning: {
    title: "Qh7# · Checkmate",
    text: "Your queen and bishop work together. The king has no safe square.",
    evaluation: "M0",
  },
  losing: {
    title: "Qh4# · Checkmate",
    text: "The king has no escape. Let's go back and find where you could have stopped the attack.",
    evaluation: "−M0",
  },
  thinking: {
    title: "Let's look at the reply",
    text: "I'm checking this move and the opponent's strongest response…",
    evaluation: "…",
  },
  uncertain: {
    title: "Let's take another look",
    text: "I don't have a reliable answer for this position yet. You can still explore the board.",
    evaluation: "—",
  },
  encouraging: {
    title: "You've got another try",
    text: "Look at the piece that just moved. What did it leave unprotected?",
    evaluation: "—",
  },
  recovered: {
    title: "That's the idea",
    text: "You found it. Spotting the threat after a miss is how the pattern sticks.",
    evaluation: "+2.50",
  },
  explaining: {
    title: "Watch the defender",
    text: "The rook is doing two jobs. Move it away and the back rank becomes vulnerable.",
    evaluation: "+3.15",
  },
  draw: {
    title: "A drawn position",
    text: "Neither side can make progress here. Sometimes holding the balance is the achievement.",
    evaluation: "0.00",
  },
};
