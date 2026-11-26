import { describe, expect, it } from "vitest";
import {
  GUESS_MATCH_ORIGINAL,
  GUESS_MATCH_PREVIOUS,
  ON_TIME_BONUS,
  VISUAL_CLARITY_BONUS,
  VOTE_CATEGORY_BONUS,
  scoreGuess,
  scoreTurn,
  tallyVotesForChain,
  votePointsForStep,
} from "../scoring";

describe("scoreGuess", () => {
  it("awards GUESS_MATCH_ORIGINAL when the guess matches the original concept", () => {
    const result = scoreGuess({
      guessText: "un gato negro",
      originalConcept: "gato negro",
      previousGuessText: "perro",
    });
    expect(result).toEqual({
      points: GUESS_MATCH_ORIGINAL,
      matchedOriginal: true,
      matchedPrevious: false,
    });
  });

  it("awards GUESS_MATCH_PREVIOUS when it only matches the previous player's guess", () => {
    const result = scoreGuess({
      guessText: "un perro",
      originalConcept: "elefante rosa",
      previousGuessText: "perro",
    });
    expect(result).toEqual({
      points: GUESS_MATCH_PREVIOUS,
      matchedOriginal: false,
      matchedPrevious: true,
    });
  });

  it("prioritizes the original match over the previous match (not cumulative)", () => {
    const result = scoreGuess({
      guessText: "gato negro",
      originalConcept: "gato negro",
      previousGuessText: "gato negro",
    });
    expect(result.points).toBe(GUESS_MATCH_ORIGINAL);
  });

  it("awards 0 points when nothing matches", () => {
    const result = scoreGuess({
      guessText: "bicicleta voladora",
      originalConcept: "gato negro",
      previousGuessText: "perro",
    });
    expect(result.points).toBe(0);
  });

  it("awards 0 when there is no previous guess and the original doesn't match", () => {
    const result = scoreGuess({
      guessText: "bicicleta",
      originalConcept: "gato negro",
      previousGuessText: null,
    });
    expect(result.points).toBe(0);
  });
});

describe("scoreTurn", () => {
  it("awards visual clarity bonus to the previous author when the guesser matched the original", () => {
    const result = scoreTurn({
      hasPreviousStep: true,
      guesserMatchedOriginal: true,
      submittedOnTime: false,
      hasStrokes: true,
    });
    expect(result.previousAuthorBonus).toBe(VISUAL_CLARITY_BONUS);
  });

  it("does not award visual clarity bonus on the very first step of a chain", () => {
    const result = scoreTurn({
      hasPreviousStep: false,
      guesserMatchedOriginal: true,
      submittedOnTime: false,
      hasStrokes: true,
    });
    expect(result.previousAuthorBonus).toBe(0);
  });

  it("awards the on-time bonus only when submitted on time AND the canvas has real strokes", () => {
    expect(
      scoreTurn({
        hasPreviousStep: false,
        guesserMatchedOriginal: false,
        submittedOnTime: true,
        hasStrokes: true,
      }).onTimeBonus,
    ).toBe(ON_TIME_BONUS);

    expect(
      scoreTurn({
        hasPreviousStep: false,
        guesserMatchedOriginal: false,
        submittedOnTime: true,
        hasStrokes: false,
      }).onTimeBonus,
    ).toBe(0);
  });
});

describe("tallyVotesForChain", () => {
  const categories = ["faithful", "funny", "plot_twist"] as const;

  it("awards the bonus to the single step with the most votes in a category", () => {
    const winners = tallyVotesForChain([...categories], [
      { stepId: "s1", playerId: "p1", votesByCategory: { faithful: 3, funny: 0, plot_twist: 1 } },
      { stepId: "s2", playerId: "p2", votesByCategory: { faithful: 1, funny: 2, plot_twist: 0 } },
    ]);

    const faithfulWinner = winners.find((w) => w.category === "faithful")!;
    expect(faithfulWinner.winningStepIds).toEqual(["s1"]);
    expect(faithfulWinner.pointsEach).toBe(VOTE_CATEGORY_BONUS);
  });

  it("awards the bonus to every tied step in a category", () => {
    const winners = tallyVotesForChain([...categories], [
      { stepId: "s1", playerId: "p1", votesByCategory: { faithful: 2, funny: 0, plot_twist: 0 } },
      { stepId: "s2", playerId: "p2", votesByCategory: { faithful: 2, funny: 0, plot_twist: 0 } },
    ]);

    const faithfulWinner = winners.find((w) => w.category === "faithful")!;
    expect(faithfulWinner.winningStepIds.sort()).toEqual(["s1", "s2"]);
  });

  it("awards no winner for a category with zero votes", () => {
    const winners = tallyVotesForChain([...categories], [
      { stepId: "s1", playerId: "p1", votesByCategory: { faithful: 0, funny: 0, plot_twist: 0 } },
    ]);
    expect(winners.every((w) => w.winningStepIds.length === 0)).toBe(true);
  });

  it("votePointsForStep sums points across all categories a step won", () => {
    const winners = tallyVotesForChain([...categories], [
      { stepId: "s1", playerId: "p1", votesByCategory: { faithful: 2, funny: 2, plot_twist: 0 } },
      { stepId: "s2", playerId: "p2", votesByCategory: { faithful: 0, funny: 0, plot_twist: 1 } },
    ]);
    expect(votePointsForStep("s1", winners)).toBe(VOTE_CATEGORY_BONUS * 2);
    expect(votePointsForStep("s2", winners)).toBe(VOTE_CATEGORY_BONUS);
  });
});
