/**
 * Helpers del cliente de juego: llamadas a los endpoints de Fase 3 y el hook
 * `useRoomState` que mantiene el estado de la sala sincronizado (fetch inicial
 * + suscripción a Realtime de `rooms` y, una vez conocida la sala, de
 * `chain_steps` / `votes` / `room_messages` / `chain_assignments`).
 */
import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  AvatarConfig,
  ChainStepRow,
  GameState,
  ProfileRow,
  RoomRow,
  RoomSettingsJson,
  Vote,
  VoteCategory,
} from "@silhouette/shared-types";

type AnyObject = Record<string, unknown>;

async function request<T = AnyObject>(url: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await res.text();
  let data: Record<string, unknown> | null = null;
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (typeof data?.error === "string" ? data.error : null) ??
      (raw ? raw.slice(0, 200) : `Error ${res.status}`);
    const detail = typeof data?.detail === "string" ? data.detail : null;
    throw new Error(detail ? `${message}: ${detail}` : message);
  }
  return data as T;
}

export const api = {
  createRoom: (settings?: Partial<RoomSettingsJson>) =>
    request<{ room: RoomRow }>("/api/rooms/create", { settings }),
  joinRoom: (code: string) => request<{ room: RoomRow }>("/api/rooms/join", { code }),
  getRoomState: async (code: string): Promise<GameState | null> => {
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) return null;
    return (await res.json()) as GameState;
  },
  startRoom: (code: string) => request(`/api/rooms/${code}/start`),
  tick: (roomId: string) => request(`/api/rooms/${roomId}/tick`),
  submitConcepts: (roomId: string, concepts: string[]) =>
    request("/api/concepts/submit", { roomId, concepts }),
  guess: (roomId: string, chainIndex: 0 | 1 | 2, guessText: string) =>
    request("/api/turns/guess", { roomId, chainIndex, guessText }),
  draw: (
    roomId: string,
    chainIndex: 0 | 1 | 2,
    payload: { original: string; silhouette: string; hasStrokes: boolean },
  ) => request("/api/turns/draw", { roomId, chainIndex, ...payload }),
  submitVotes: (roomId: string, chainIndex: 0 | 1 | 2, votes: { category: VoteCategory }[]) =>
    request("/api/votes/submit", { roomId, chainIndex, votes }),
  sendMessage: (roomId: string, content: string) =>
    request("/api/chat/send", { roomId, content }),
  updateProfile: (payload: { username?: string; avatar_config?: AvatarConfig }) =>
    request<{ profile: ProfileRow }>("/api/profile", payload),
  updateRoomSettings: (code: string, settings: RoomSettingsJson) =>
    request<{ room: RoomRow }>(`/api/rooms/${code}/settings`, { settings }),
  setReady: (code: string, isReady: boolean) =>
    request(`/api/rooms/${code}/ready`, { isReady }),
};

const REALTIME_TABLES = [
  "room_players",
  "chain_assignments",
  "chain_steps",
  "votes",
  "room_messages",
] as const;

/**
 * Mantiene el estado de la sala: fetch inicial + suscripción a Realtime
 * (`rooms` por código y, una vez conocida la sala, el resto por `room_id`)
 * + un poll de respaldo cada 3s.
 */
export function useRoomState(code: string | null) {
  const [state, setState] = useState<GameState | null>(null);

  const refresh = useCallback(async () => {
    if (!code) return;
    const data = await api.getRoomState(code);
    if (data) setState(data);
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    void refresh();

    const channel = getSupabaseClient().channel(`room:${code}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` }, () => {
        if (alive) void refresh();
      })
      .subscribe();
    const poll = setInterval(() => {
      if (alive) void refresh();
    }, 3000);
    return () => {
      alive = false;
      clearInterval(poll);
      channel.unsubscribe();
    };
  }, [code, refresh]);

  useEffect(() => {
    const roomId = state?.room.id;
    if (!roomId) return;
    const channel = getSupabaseClient().channel(`room:${roomId}-sync`);
    for (const table of REALTIME_TABLES) {
      channel
        .on("postgres_changes", { event: "*", schema: "public", table, filter: `room_id=eq.${roomId}` }, () => {
          void refresh();
        })
        .subscribe();
    }
    return () => {
      void channel.unsubscribe();
    };
  }, [state?.room.id, refresh]);

  return { state, refresh };
}

/** Agrupa los pasos de una cadena ordenados por step_number. */
export function groupStepsByChain(steps: ChainStepRow[]): Record<0 | 1 | 2, ChainStepRow[]> {
  const grouped: Record<0 | 1 | 2, ChainStepRow[]> = { 0: [], 1: [], 2: [] };
  for (const step of steps) {
    grouped[step.chain_index].push(step);
  }
  return grouped;
}

export type { GameState, RoomRow, Vote };
