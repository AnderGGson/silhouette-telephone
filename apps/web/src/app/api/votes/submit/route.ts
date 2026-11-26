import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { tickRoom } from "@/lib/game/tick";
import type { RoomRow } from "@silhouette/shared-types";
import { VOTE_CATEGORIES } from "@silhouette/shared-types";
import type { VoteCategory } from "@silhouette/shared-types";
import { badRequest, conflict, notFound, ok, parseJson, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/**
 * Registra los votos del jugador para `faithful`, `funny` y `plot_twist`
 * en la cadena revelada actual (una por categoría, opcionalmente con stepId).
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{
    roomId?: string;
    chainIndex?: number;
    votes?: { category?: string; stepId?: string }[];
  }>(request);
  if (!body?.roomId) return badRequest("Se requiere roomId");
  if (typeof body.chainIndex !== "number" || body.chainIndex < 0 || body.chainIndex > 2) {
    return badRequest("chainIndex inválido (0..2)");
  }
  if (!Array.isArray(body.votes) || body.votes.length === 0) {
    return badRequest("Se requiere al menos un voto");
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

  if (roomRow.status !== "REVEAL_AND_VOTE") {
    return conflict("Los votos solo se aceptan durante REVEAL_AND_VOTE");
  }

  // Determinamos el paso objetivo predeterminado: el primero de la cadena.
  const { data: chainSteps } = await getAdminClient()
    .from("chain_steps")
    .select("id")
    .eq("room_id", roomRow.id)
    .eq("round_number", roomRow.round_number)
    .eq("chain_index", body.chainIndex)
    .order("step_number", { ascending: true })
    .limit(1);
  const defaultStepId = chainSteps?.[0]?.id;

  const inserts: {
    room_id: string;
    round_number: number;
    chain_index: number;
    voter_id: string;
    target_step_id: string;
    category: VoteCategory;
  }[] = [];
  for (const vote of body.votes) {
    const category = VOTE_CATEGORIES.find((c) => c === vote.category);
    if (!category) return badRequest(`Categoría de voto inválida: ${vote.category}`);
    let targetStepId = vote.stepId;
    if (!targetStepId) targetStepId = defaultStepId;
    if (!targetStepId) return badRequest("No hay pasos visibles en esta cadena para votar");
    if (!targetStepId) continue;
    inserts.push({
      room_id: roomRow.id,
      round_number: roomRow.round_number,
      chain_index: body.chainIndex,
      voter_id: user.id,
      target_step_id: targetStepId,
      category,
    });
  }
  if (inserts.length === 0) return badRequest("No hay votos válidos para registrar");

  const { error } = await getAdminClient().from("votes").insert(inserts);
  if (error) return badRequest("Error registrando votos");

  await tickRoom(roomRow.id);
  return ok({ ok: true, inserted: inserts.length });
}
