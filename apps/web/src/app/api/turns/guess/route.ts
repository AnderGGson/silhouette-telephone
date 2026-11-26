import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { tickRoom } from "@/lib/game/tick";
import type { ChainAssignmentRow, RoomRow } from "@silhouette/shared-types";
import {
  badRequest,
  conflict,
  notFound,
  ok,
  parseJson,
  requireUser,
  unauthorized,
  validateText,
  MAX_GUESS_LENGTH,
} from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/**
 * Guarda `guess_text` en `chain_assignments` (el dibujante asignado) y
 * dispara el tick si todos los asignados ya adivinaron.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{
    roomId?: string;
    chainIndex?: number;
    guessText?: string;
  }>(request);
  if (!body?.roomId) return badRequest("Se requiere roomId");
  if (typeof body.chainIndex !== "number" || body.chainIndex < 0 || body.chainIndex > 2) {
    return badRequest("chainIndex inválido (0..2)");
  }

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

  const { data: assignment } = await getAdminClient()
    .from("chain_assignments")
    .select("*")
    .eq("room_id", roomRow.id)
    .eq("round_number", roomRow.round_number)
    .eq("chain_index", body.chainIndex)
    .eq("assigned_user_id", user.id)
    .single();
  if (!assignment) {
    return conflict("No tienes asignación activa en esta cadena para adivinar");
  }
  const chainAssignment = assignment as ChainAssignmentRow;

  const guessText = validateText(body.guessText, 1, MAX_GUESS_LENGTH);
  if (!guessText) {
    return badRequest("El texto de adivinanza debe tener entre 1 y 80 caracteres");
  }

  await getAdminClient()
    .from("chain_assignments")
    .update({ guess_text: guessText, guess_submitted: true })
    .eq("id", chainAssignment.id);

  // Todos los asignados ya adivinaron → el tick avanza el turno.
  const { data: rows } = await getAdminClient()
    .from("chain_assignments")
    .select("guess_submitted")
    .eq("room_id", roomRow.id)
    .eq("round_number", roomRow.round_number)
    .eq("chain_index", body.chainIndex);
  if ((rows ?? []).every((r) => r.guess_submitted)) {
    await tickRoom(roomRow.id);
  }

  return ok({ ok: true, assignmentId: chainAssignment.id });
}
