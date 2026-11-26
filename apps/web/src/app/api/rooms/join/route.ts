import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_PLAYERS, type RoomRow } from "@silhouette/shared-types";
import {
  badRequest,
  conflict,
  isRoomCode,
  ok,
  parseJson,
  requireUser,
  serverError,
  unauthorized,
} from "@/lib/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let admin;
  try {
    admin = getAdminClient();
  } catch (e) {
    return serverError(
      "Configuración del servidor incompleta",
      e instanceof Error ? e.message : String(e),
    );
  }

  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ code?: string }>(request);
  if (!isRoomCode(body?.code)) {
    return badRequest("Código de sala inválido (se espera un código de 6 caracteres)");
  }
  const code = body!.code!.trim();

  const server = getSupabaseServerClient(request);
  const { data: room } = await server
    .from("rooms")
    .select("*")
    .eq("code", code)
    .eq("status", "LOBBY")
    .single();
  if (!room) return conflict("Sala no encontrada o no está abierta");

  const roomRow = room as RoomRow;

  // Reconocimiento de miembro existente (reconectado).
  const { data: existing } = await server
    .from("room_players")
    .select("id")
    .eq("room_id", roomRow.id)
    .eq("user_id", user.id)
    .single();
  if (existing) {
    const { error: reconnectError } = await admin
      .from("room_players")
      .update({ is_connected: true })
      .eq("room_id", roomRow.id)
      .eq("user_id", user.id);
    if (reconnectError) return serverError("Error al reconectar", reconnectError.message);
    return ok({ room: roomRow, joined: true, reconnected: true });
  }

  const { count } = await server
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomRow.id);
  const seat = count ?? 0;
  if (seat >= MAX_PLAYERS) {
    return conflict("La sala está llena (máximo 8 jugadores)");
  }

  const { data: player, error: insertError } = await admin
    .from("room_players")
    .insert({ room_id: roomRow.id, user_id: user.id, seat_index: seat, is_ready: false, is_connected: true })
    .select("*")
    .single();
  if (insertError) {
    return serverError("No se pudo unir a la sala", insertError.message);
  }

  return ok({ room: roomRow, joined: true, seatIndex: player?.seat_index ?? seat });
}
