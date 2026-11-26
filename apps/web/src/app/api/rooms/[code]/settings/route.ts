import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { validateRoomSettings, type RoomRow } from "@silhouette/shared-types";
import { badRequest, conflict, notFound, ok, parseJson, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/**
 * Ajustes de sala antes de iniciar (Fase 4, per host en LOBBY):
 * `settings` validada (conceptSubmissionSeconds, guessSeconds, drawSeconds,
 * conceptsPerPlayer, etc.) y `max_steps` derivado de `maxChainSteps`.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ settings?: Record<string, unknown> }>(request);
  if (!body?.settings || typeof body.settings !== "object") {
    return badRequest("Se requiere settings");
  }

  const server = getSupabaseServerClient(request);
  const { data: room } = await server.from("rooms").select("*").eq("code", code).single();
  if (!room) return notFound("Sala no encontrada");
  const roomRow = room as RoomRow;
  if (roomRow.host_id !== user.id) {
    return badRequest("Solo el anfitrión puede cambiar ajustes");
  }
  if (roomRow.status !== "LOBBY") {
    return conflict("La sala no está abierta para ajustes");
  }

  const settings = { ...roomRow.settings, ...body.settings } as RoomRow["settings"];
  const errors = validateRoomSettings(settings);
  if (errors.length > 0) {
    return badRequest(`Configuración inválida: ${errors.map((e) => e.message).join("; ")}`);
  }

  const { data: updated } = await getAdminClient()
    .from("rooms")
    .update({ settings, max_steps: settings.maxChainSteps ?? roomRow.max_steps })
    .eq("id", roomRow.id)
    .select("*")
    .single();

  return ok({ room: updated as RoomRow });
}
