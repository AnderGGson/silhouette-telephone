export type RoomStatus =
  | "LOBBY"
  | "CONCEPT_SUBMISSION"
  | "CONCEPT_DRAW"
  | "PLAYING_TURN"
  | "REVEAL_AND_VOTE"
  | "PODIUM";

export type TurnSubphase = "GUESSING" | "DRAWING";

export type BlurIntensity = "soft" | "medium" | "extreme";

export type VoteCategory = "faithful" | "funny" | "plot_twist";

export const VOTE_CATEGORIES: VoteCategory[] = [
  "faithful",
  "funny",
  "plot_twist",
];

export const CHAIN_COUNT = 3;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export interface RoomSettings {
  conceptSubmissionSeconds: number; // 10-45
  guessSeconds: number; // 5-20
  drawSeconds: number; // 20-120
  blurIntensity: BlurIntensity;
  maxChainSteps: number; // 3-6
  conceptsPerPlayer: number; // 1-4
  muteChatDuringDraw: boolean;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  conceptSubmissionSeconds: 20,
  guessSeconds: 10,
  drawSeconds: 50,
  blurIntensity: "medium",
  maxChainSteps: 4,
  conceptsPerPlayer: 2,
  muteChatDuringDraw: false,
};

export interface RoomSettingsValidationError {
  field: keyof RoomSettings;
  message: string;
}

export function validateRoomSettings(
  settings: RoomSettings,
): RoomSettingsValidationError[] {
  const errors: RoomSettingsValidationError[] = [];
  const inRange = (n: number, lo: number, hi: number) => n >= lo && n <= hi;

  if (!inRange(settings.conceptSubmissionSeconds, 10, 45)) {
    errors.push({
      field: "conceptSubmissionSeconds",
      message: "conceptSubmissionSeconds debe estar entre 10 y 45",
    });
  }
  if (!inRange(settings.guessSeconds, 5, 20)) {
    errors.push({
      field: "guessSeconds",
      message: "guessSeconds debe estar entre 5 y 20",
    });
  }
  if (!inRange(settings.drawSeconds, 20, 120)) {
    errors.push({
      field: "drawSeconds",
      message: "drawSeconds debe estar entre 20 y 120",
    });
  }
  if (!inRange(settings.maxChainSteps, 3, 6)) {
    errors.push({
      field: "maxChainSteps",
      message: "maxChainSteps debe estar entre 3 y 6",
    });
  }
  if (!inRange(settings.conceptsPerPlayer, 1, 4)) {
    errors.push({
      field: "conceptsPerPlayer",
      message: "conceptsPerPlayer debe estar entre 1 y 4",
    });
  }
  return errors;
}

export interface Player {
  id: string;
  username: string;
  seatIndex: number;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  score: number;
}

export interface Concept {
  id: string;
  text: string;
  authorId: string | null;
  isSelected: boolean;
  chainIndex: 0 | 1 | 2 | null;
}

/** One assignment of a player to a (chain, step) pair for the current round of turns. */
export interface ChainAssignment {
  chainIndex: 0 | 1 | 2;
  stepNumber: number;
  conceptId: string;
  assignedUserId: string;
}

/** A fully completed and persisted step in a chain's history, used for reveal + scoring. */
export interface ChainStep {
  chainIndex: 0 | 1 | 2;
  stepNumber: number;
  conceptId: string;
  playerId: string;
  guessText: string | null;
  originalImagePath: string;
  silhouetteImagePath: string;
  autoPoints: number;
  votePoints: number;
  submittedOnTime: boolean;
}

export interface Vote {
  voterId: string;
  chainIndex: 0 | 1 | 2;
  targetStepId: string;
  category: VoteCategory;
}
