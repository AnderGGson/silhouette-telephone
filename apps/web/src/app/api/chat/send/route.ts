import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RoomRow } from "@silhouette/shared-types";
import { MAX_MESSAGE_LENGTH, badRequest, conflict, notFound, ok, parseJson, requireUser, unauthorized, validateText } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

const SPAM_WINDOW_MS = 1200;

/**
 * Inserta mensaje en `room_messages` tras validar sesión, pertenencia a la
 * sala, longitud y la regla de `muteChatDuringDraw`.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ roomId?: string; content?: string }>(request);
  if (!body?.roomId) return badRequest("Se requiere roomId");

  const server = getSupabaseServerClient(request);
  const { data: room } = await server.from("rooms").select("*").eq("id", body.roomId).single();
  if (!room) return notFound("Sala no encontrada");
  const roomRow = room as RoomRow;

  const { data: participant } = await server
    .from("room_players")
    .select("id")
    .eq("room_id", roomRow.id)
    .eq("user_id", user.id)
    .single();
  if (!participant) return notFound("No participas en esta sala");

  const content = validateText(body.content, 1, MAX_MESSAGE_LENGTH);
  if (!content) return badRequest("El mensaje debe tener entre 1 y 280 caracteres");

  // Regla muteChatDuringDraw: el chat queda solo-lectura durante PLAYING_TURN.
  if (roomRow.settings?.muteChatDuringDraw && roomRow.status === "PLAYING_TURN") {
    return conflict("El chat está desactivado durante los dibujos");
  }

  // Anti-spam básico: máximo un mensaje cada 1.2s por usuario.
  const { data: last } = await server
    .from("room_messages")
    .select("created_at")
    .eq("room_id", roomRow.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (last?.created_at) {
    const elapsed = Date.now() - new Date(last.created_at).getTime();
    if (elapsed < SPAM_WINDOW_MS) {
      return conflict("Demasiados mensajes; inténtalo de nuevo más tarde");
    }
  }

  const { error } = await server.from("room_messages").insert({
    room_id: roomRow.id,
    user_id: user.id,
    is_system: false,
    content,
  });
  if (error) return badRequest("No se pudo enviar el mensaje");

  return ok({ ok: true });
}
