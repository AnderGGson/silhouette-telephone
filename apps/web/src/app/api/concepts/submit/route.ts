import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeText } from "@silhouette/game-engine";
import type { RoomRow } from "@silhouette/shared-types";
import {
  badRequest,
  conflict,
  notFound,
  ok,
  parseJson,
  requireUser,
  unauthorized,
} from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/**
 * Guarda el/los conceptos del jugador en `concepts` durante `CONCEPT_SUBMISSION`.
 * Validación: longitud 2–60, cuota `conceptsPerPlayer` y duplicados normalizados.
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ roomId?: string; concepts?: string[] }>(request);
  if (!body?.roomId || !Array.isArray(body.concepts)) {
    return badRequest("Se requieren roomId y concepts (array de strings)");
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

  if (roomRow.status !== "CONCEPT_SUBMISSION") {
    return conflict("No es el periodo de envío de conceptos");
  }

  const conceptsPerPlayer = roomRow.settings?.conceptsPerPlayer ?? 2;
  if (body.concepts.length > conceptsPerPlayer) {
    return badRequest(`Excedes el límite de conceptos por jugador (${conceptsPerPlayer})`);
  }

  const { data: existing } = await server
    .from("concepts")
    .select("text")
    .eq("room_id", roomRow.id)
    .eq("round_number", roomRow.round_number)
    .eq("author_id", user.id);
  const seen = new Set((existing ?? []).map((c) => c.text.toLowerCase()));

  const texts: string[] = [];
  for (const raw of body.concepts) {
    if (typeof raw !== "string") return badRequest("Los conceptos deben ser texto");
    const text = raw.trim();
    if (text.length < 2 || text.length > 60) {
      return badRequest("Los conceptos deben tener entre 2 y 60 caracteres");
    }
    const norm = normalizeText(text);
    if (norm.length === 0) return badRequest("Concepto inválido");
    if (seen.has(norm)) return badRequest(`Concepto duplicado: ${text}`);
    seen.add(norm);
    texts.push(text);
  }
  if (texts.length === 0) return badRequest("Al menos un concepto es requerido");

  const { error } = await getAdminClient().from("concepts").insert(
    texts.map((text) => ({
      room_id: roomRow.id,
      round_number: roomRow.round_number,
      author_id: user.id,
      text,
    })),
  );
  if (error) return badRequest("Error guardando los conceptos");

  return ok({ ok: true, inserted: texts.length });
}
