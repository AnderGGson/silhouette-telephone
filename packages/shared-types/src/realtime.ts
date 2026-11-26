/**
 * Contratos de eventos para el canal de Supabase Realtime `room:{code}`.
 * - Postgres Changes cubre: rooms, room_players, chain_steps, votes, room_messages.
 * - Broadcast cubre eventos efímeros de alta frecuencia (trazos en vivo, avisos de fase)
 *   que no necesitan persistirse evento-por-evento.
 */

export type BroadcastEventName =
  | "stroke:add"
  | "stroke:clear"
  | "phase:tick"
  | "player:typing";

export interface StrokeAddPayload {
  chainIndex: 0 | 1 | 2;
  playerId: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  size: "sm" | "md" | "lg" | "xl";
  tool: "brush" | "eraser";
}

export interface StrokeClearPayload {
  chainIndex: 0 | 1 | 2;
  playerId: string;
}

export interface PhaseTickPayload {
  stepEndsAt: string; // ISO timestamp, authoritative from server
  serverNow: string; // ISO timestamp, for client clock-drift correction
}

export interface PlayerTypingPayload {
  chainIndex: 0 | 1 | 2;
  playerId: string;
  isTyping: boolean;
}

export type BroadcastPayloadMap = {
  "stroke:add": StrokeAddPayload;
  "stroke:clear": StrokeClearPayload;
  "phase:tick": PhaseTickPayload;
  "player:typing": PlayerTypingPayload;
};

export function roomChannelName(code: string): string {
  return `room:${code}`;
}
