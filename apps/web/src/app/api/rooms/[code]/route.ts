import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_AVATAR_CONFIG } from "@silhouette/shared-types";
import type {
  ChainAssignmentRow,
  ChainStepRow,
  ConceptRow,
  GameState,
  RoomMessageRow,
  RoomPlayerPublic,
  RoomRow,
} from "@silhouette/shared-types";
import { notFound, ok, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/**
 * Estado completo de la sala autorizado: sala, jugadores (con datos públicos
 * de perfil), asignaciones del usuario actual, pasos visibles y mensajes recientes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const server = getSupabaseServerClient(request);
  const { data: room } = await server.from("rooms").select("*").eq("code", code).single();
  if (!room) return notFound("Sala no encontrada");
  const roomRow = room as RoomRow;

  const userId = user.id;
  const [playersRaw, myAssignments, steps, messages, concepts] = await Promise.all([
    server
      .from("room_players")
      .select("*")
      .eq("room_id", roomRow.id)
      .order("seat_index", { ascending: true })
      .then((r) => r.data ?? []),
    server
      .from("chain_assignments")
      .select("*")
      .eq("room_id", roomRow.id)
      .eq("assigned_user_id", userId)
      .then((r) => r.data ?? []),
    server
      .from("chain_steps")
      .select("*")
      .eq("room_id", roomRow.id)
      .order("chain_index", { ascending: true })
      .order("step_number", { ascending: true })
      .then((r) => r.data ?? []),
    server
      .from("room_messages")
      .select("*")
      .eq("room_id", roomRow.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then((r) => (r.data ?? []).reverse()),
    server
      .from("concepts")
      .select("*")
      .eq("room_id", roomRow.id)
      .or(`author_id.eq.${userId},is_selected.eq.true`)
      .then((r) => r.data ?? []),
  ]);

  const { data: profiles } = await server
    .from("profiles")
    .select("id, username, is_guest, avatar_config, total_points, games_played")
    .in("id", playersRaw.map((p) => p.user_id));

  const players: RoomPlayerPublic[] = playersRaw.map((p) => {
    const prof = profiles?.find((q) => q.id === p.user_id);
    return {
      ...p,
      username: prof?.username ?? "Jugador",
      avatar_config: prof?.avatar_config ?? DEFAULT_AVATAR_CONFIG,
      is_guest: prof?.is_guest ?? false,
      total_points: prof?.total_points ?? 0,
      games_played: prof?.games_played ?? 0,
    };
  });

  const state: GameState = {
    room: roomRow,
    players,
    myAssignments: myAssignments as ChainAssignmentRow[],
    steps: steps as ChainStepRow[],
    messages: messages as RoomMessageRow[],
    concepts: concepts as ConceptRow[],
  };

  return ok(state);
}
