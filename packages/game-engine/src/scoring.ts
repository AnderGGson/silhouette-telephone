import type { VoteCategory } from "@silhouette/shared-types";
import { matchesConcept } from "./textMatching";

export const GUESS_MATCH_ORIGINAL = 100;
export const GUESS_MATCH_PREVIOUS = 50;
export const VISUAL_CLARITY_BONUS = 75;
export const ON_TIME_BONUS = 25;
export const VOTE_CATEGORY_BONUS = 150;

export interface GuessScoringInput {
  /** Texto escrito por el jugador en "¿Qué viste?" para este paso (step_number > 1). */
  guessText: string;
  /** Concepto original que inició la cadena. */
  originalConcept: string;
  /** Texto que el jugador anterior escribió/interpretó (null si es el paso 2, sin adivinanza previa aplicable). */
  previousGuessText: string | null;
}

export interface GuessScoringResult {
  points: number;
  matchedOriginal: boolean;
  matchedPrevious: boolean;
}

/**
 * Puntos por la sub-fase de adivinanza ("¿Qué viste?"). Un acierto del concepto
 * original tiene prioridad y no es acumulable con el acierto de "coincide con
 * el anterior": se otorga el mayor de los dos aplicables.
 */
export function scoreGuess(input: GuessScoringInput): GuessScoringResult {
  const matchedOriginal = matchesConcept(
    input.guessText,
    input.originalConcept,
  );
  const matchedPrevious = Boolean(
    input.previousGuessText &&
      !matchedOriginal &&
      matchesConcept(input.guessText, input.previousGuessText),
  );

  if (matchedOriginal) {
    return { points: GUESS_MATCH_ORIGINAL, matchedOriginal, matchedPrevious: false };
  }
  if (matchedPrevious) {
    return { points: GUESS_MATCH_PREVIOUS, matchedOriginal: false, matchedPrevious };
  }
  return { points: 0, matchedOriginal: false, matchedPrevious: false };
}

export interface TurnScoringInput {
  /** true si la silueta del paso anterior venía de un dibujo (step_number > 1). */
  hasPreviousStep: boolean;
  /** Si el jugador de este paso acertó el concepto original a partir de la silueta anterior. */
  guesserMatchedOriginal: boolean;
  /** true si el dibujo fue enviado antes de que expirara el temporizador. */
  submittedOnTime: boolean;
  /** true si el canvas contenía trazos reales (no estaba vacío). */
  hasStrokes: boolean;
}

export interface TurnScoringResult {
  /** Puntos para el autor del paso anterior (claridad visual), 0 si no aplica. */
  previousAuthorBonus: number;
  /** Puntos de puntualidad para el autor de este paso. */
  onTimeBonus: number;
}

/**
 * Calcula los bonos automáticos derivados de un turno de dibujo:
 * - Claridad visual: recompensa al autor del paso k-1 cuando el jugador del
 *   paso k acierta el concepto original gracias a su silueta.
 * - Puntualidad: recompensa al autor de este paso si entregó a tiempo con
 *   trazos reales.
 */
export function scoreTurn(input: TurnScoringInput): TurnScoringResult {
  const previousAuthorBonus =
    input.hasPreviousStep && input.guesserMatchedOriginal
      ? VISUAL_CLARITY_BONUS
      : 0;
  const onTimeBonus =
    input.submittedOnTime && input.hasStrokes ? ON_TIME_BONUS : 0;

  return { previousAuthorBonus, onTimeBonus };
}

export interface VoteTally {
  stepId: string;
  playerId: string;
  votesByCategory: Record<VoteCategory, number>;
}

export interface VoteCategoryWinner {
  category: VoteCategory;
  winningStepIds: string[];
  pointsEach: number;
}

/**
 * Determina, para cada categoría de votación dentro de una cadena, qué paso(s)
 * ganaron. En caso de empate en primer lugar, todos los empatados reciben el
 * bono completo (regla documentada explícitamente en la especificación).
 */
export function tallyVotesForChain(
  categories: VoteCategory[],
  steps: VoteTally[],
): VoteCategoryWinner[] {
  return categories.map((category) => {
    let maxVotes = 0;
    for (const step of steps) {
      const count = step.votesByCategory[category] ?? 0;
      if (count > maxVotes) maxVotes = count;
    }

    const winningStepIds =
      maxVotes > 0
        ? steps
            .filter((s) => (s.votesByCategory[category] ?? 0) === maxVotes)
            .map((s) => s.stepId)
        : [];

    return { category, winningStepIds, pointsEach: VOTE_CATEGORY_BONUS };
  });
}

/** Suma total de puntos por votos que recibe un paso específico a partir de los ganadores por categoría. */
export function votePointsForStep(
  stepId: string,
  winners: VoteCategoryWinner[],
): number {
  return winners
    .filter((w) => w.winningStepIds.includes(stepId))
    .reduce((sum, w) => sum + w.pointsEach, 0);
}
