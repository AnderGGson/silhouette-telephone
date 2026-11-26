import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { scoreGuess, scoreTurn } from "@silhouette/game-engine";
import type { ChainAssignmentRow, RoomRow } from "@silhouette/shared-types";
import {
  badRequest,
  conflict,
  notFound,
  ok,
  parseJson,
  requireUser,
  unauthorized,
} from "@/lib/api/utils";
import { tickRoom } from "@/lib/game/tick";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const nowMs = () => Date.now();

function base64ToBuffer(input: unknown): Buffer | null {
  if (typeof input !== "string" || input.length === 0) return null;
  const raw = input.startsWith("data:") ? (input.split(",")[1] ?? "") : input;
  if (raw.length === 0) return null;
  try {
    const buffer = Buffer.from(raw, "base64");
    return buffer.length > 0 && buffer.length <= MAX_IMAGE_BYTES ? buffer : null;
  } catch {
    return null;
  }
}

/**
 * Sube `original` y `silhouette` al bucket `drawings`, registra `chain_steps`,
 * calcula los puntos automáticos con `@silhouette/game-engine`
 * (incluyendo claridad visual al paso anterior y entrega a tiempo) y marca
 * `draw_submitted`. dispara el tick si todos dibujaron.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{
    roomId?: string;
    chainIndex?: number;
    original?: string;
    silhouette?: string;
    hasStrokes?: boolean;
  }>(request);
  if (!body?.roomId) return badRequest("Se requiere roomId");
  if (typeof body.chainIndex !== "number" || body.chainIndex < 0 || body.chainIndex > 2) {
    return badRequest("chainIndex inválido (0..2)");
  }

  const originalBuffer = base64ToBuffer(body.original);
  const silhouetteBuffer = base64ToBuffer(body.silhouette);
  if (!originalBuffer || !silhouetteBuffer) {
    return badRequest("Se requieren original y silhouette (base64) válidos");
  }
  const hasStrokes = body.hasStrokes ?? true;

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
    .eq("draw_submitted", false)
    .single();
  if (!assignment) return conflict("No tienes un paso de dibujo activo en esta cadena");
  const chainAssignment = assignment as ChainAssignmentRow;

  // Subida a Storage: {room_id}/{round}/chain-{i}/step-{n}/{original|silhouette}.png
  const stepPath = `${roomRow.id}/${roomRow.round_number}/chain-${body.chainIndex}/step-${chainAssignment.step_number}`;
  const originalPath = `${stepPath}/original.png`;
  const silhouettePath = `${stepPath}/silhouette.png`;
  const uploadOriginal = await getAdminClient().storage
    .from("drawings")
    .upload(originalPath, originalBuffer, { contentType: "image/png", upsert: true });
  if (uploadOriginal.error) return badRequest("No se pudo subir el dibujo original");
  const uploadSilhouette = await getAdminClient().storage
    .from("drawings")
    .upload(silhouettePath, silhouetteBuffer, { contentType: "image/png", upsert: true });
  if (uploadSilhouette.error) return badRequest("No se pudo subir la silueta");
  const { data: publicUrlData } = getAdminClient().storage.from("drawings").getPublicUrl(originalPath);
  const originalUrl = publicUrlData?.publicUrl ?? originalPath;

  // Puntos automáticos con game-engine.
  const { data: concept } = await getAdminClient()
    .from("concepts")
    .select("text")
    .eq("id", chainAssignment.concept_id)
    .single();
  const { data: history } = await getAdminClient()
    .from("chain_steps")
    .select("step_number, guess_text")
    .eq("room_id", roomRow.id)
    .eq("round_number", roomRow.round_number)
    .eq("chain_index", body.chainIndex)
    .order("step_number", { ascending: true });
  const prevStep = (history ?? []).find((h) => h.step_number === chainAssignment.step_number - 1) ?? null;

  const guessScore = scoreGuess({
    guessText: chainAssignment.guess_text ?? "",
    originalConcept: concept?.text ?? "",
    previousGuessText: prevStep?.guess_text ?? null,
  });
  const onTime = roomRow.step_ends_at ? nowMs() < new Date(roomRow.step_ends_at).getTime() : false;
  const { previousAuthorBonus, onTimeBonus } = scoreTurn({
    hasPreviousStep: chainAssignment.step_number > 1,
    guesserMatchedOriginal: guessScore.matchedOriginal,
    submittedOnTime: onTime,
    hasStrokes: Boolean(hasStrokes),
  });

  // Registro en `chain_steps`.
  const payload = {
    room_id: roomRow.id,
    round_number: roomRow.round_number,
    chain_index: body.chainIndex,
    concept_id: chainAssignment.concept_id,
    step_number: chainAssignment.step_number,
    player_id: user.id,
    guess_text: chainAssignment.guess_text ?? null,
    original_image_path: originalUrl,
    silhouette_image_path: publicUrlData?.publicUrl ?? silhouettePath,
    auto_points: onTimeBonus,
    vote_points: 0,
    submitted_on_time: onTime,
  };
  const { data: existing } = await getAdminClient()
    .from("chain_steps")
    .select("id")
    .eq("room_id", roomRow.id)
    .eq("round_number", roomRow.round_number)
    .eq("chain_index", body.chainIndex)
    .eq("step_number", chainAssignment.step_number)
    .single();
  if (existing?.id) {
    await getAdminClient().from("chain_steps").update(payload).eq("id", existing.id);
  } else {
    await getAdminClient().from("chain_steps").insert(payload);
  }

  if (previousAuthorBonus > 0 && chainAssignment.step_number > 1) {
    const { data: prevStepRow } = await getAdminClient()
      .from("chain_steps")
      .select("id, auto_points")
      .eq("room_id", roomRow.id)
      .eq("round_number", roomRow.round_number)
      .eq("chain_index", body.chainIndex)
      .eq("step_number", chainAssignment.step_number - 1)
      .single();
    if (prevStepRow?.id) {
      await getAdminClient()
        .from("chain_steps")
        .update({ auto_points: (prevStepRow.auto_points ?? 0) + previousAuthorBonus })
        .eq("id", prevStepRow.id);
    }
  }

  if (onTimeBonus > 0) {
    const { data: rp } = await getAdminClient()
      .from("room_players")
      .select("id, score")
      .eq("room_id", roomRow.id)
      .eq("user_id", user.id)
      .single();
    if (rp?.id) {
      await getAdminClient()
        .from("room_players")
        .update({ score: (rp.score ?? 0) + onTimeBonus })
        .eq("id", rp.id);
    }
  }
  await getAdminClient()
    .from("chain_assignments")
    .update({ draw_submitted: true })
    .eq("id", chainAssignment.id);

  if (roomRow.status === "PLAYING_TURN" && roomRow.turn_subphase === "DRAWING") {
    await tickRoom(roomRow.id);
  }

  return ok({ ok: true, stepId: existing?.id ?? undefined, onTimeBonus, previousAuthorBonus });
}
