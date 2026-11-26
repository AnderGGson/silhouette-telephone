import type { AvatarConfig } from "./avatar";
import type { BlurIntensity, RoomStatus, TurnSubphase, VoteCategory } from "./game";

export interface ProfileRow {
  id: string;
  username: string;
  is_guest: boolean;
  avatar_config: AvatarConfig;
  total_points: number;
  games_played: number;
  created_at: string;
  updated_at: string;
}

export interface RoomSettingsJson {
  conceptSubmissionSeconds: number;
  guessSeconds: number;
  drawSeconds: number;
  blurIntensity: BlurIntensity;
  conceptsPerPlayer: number;
  muteChatDuringDraw: boolean;
  /** Pasos por cadena; respaldado por `rooms.max_steps` cuando no se informa. */
  maxChainSteps: number;
}

export interface RoomRow {
  id: string;
  code: string;
  host_id: string;
  status: RoomStatus;
  turn_subphase: TurnSubphase;
  round_number: number;
  max_steps: number;
  min_players: 2;
  max_players: 8;
  active_reveal_chain: 0 | 1 | 2;
  settings: RoomSettingsJson;
  step_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomPlayerRow {
  id: string;
  room_id: string;
  user_id: string;
  seat_index: number;
  score: number;
  is_ready: boolean;
  is_connected: boolean;
  joined_at: string;
}

export interface ConceptRow {
  id: string;
  room_id: string;
  round_number: number;
  author_id: string | null;
  text: string;
  is_selected: boolean;
  chain_index: 0 | 1 | 2 | null;
  created_at: string;
}

export interface ChainAssignmentRow {
  id: string;
  room_id: string;
  round_number: number;
  chain_index: 0 | 1 | 2;
  concept_id: string;
  step_number: number;
  assigned_user_id: string;
  guess_text: string | null;
  guess_submitted: boolean;
  draw_submitted: boolean;
  created_at: string;
}

export interface ChainStepRow {
  id: string;
  room_id: string;
  round_number: number;
  chain_index: 0 | 1 | 2;
  concept_id: string;
  step_number: number;
  player_id: string;
  guess_text: string | null;
  original_image_path: string;
  silhouette_image_path: string;
  auto_points: number;
  vote_points: number;
  submitted_on_time: boolean;
  created_at: string;
}

export interface VoteRow {
  id: string;
  room_id: string;
  round_number: number;
  chain_index: 0 | 1 | 2;
  voter_id: string;
  target_step_id: string;
  category: VoteCategory;
  created_at: string;
}

export interface RoomMessageRow {
  id: string;
  room_id: string;
  user_id: string | null;
  content: string;
  is_system: boolean;
  created_at: string;
}

/**
 * `RoomPlayerRow` enriquecido con datos públicos de perfil
 * (`GET /api/rooms/[code]` une `room_players` con `profiles` para la UI).
 */
export interface RoomPlayerPublic extends RoomPlayerRow {
  username: string;
  avatar_config: AvatarConfig;
  is_guest: boolean;
  total_points: number;
  games_played: number;
}

/** Estado completo de una sala devuelto por `GET /api/rooms/[code]`. */
export interface GameState {
  room: RoomRow;
  players: RoomPlayerPublic[];
  myAssignments: ChainAssignmentRow[];
  steps: ChainStepRow[];
  messages: RoomMessageRow[];
  concepts: ConceptRow[];
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow };
      rooms: { Row: RoomRow };
      room_players: { Row: RoomPlayerRow };
      concepts: { Row: ConceptRow };
      chain_assignments: { Row: ChainAssignmentRow };
      chain_steps: { Row: ChainStepRow };
      votes: { Row: VoteRow };
      room_messages: { Row: RoomMessageRow };
    };
  };
}
