import type { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { badRequest, notFound, ok, parseJson, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/** Marca/desmarca el estado "Listo" de un jugador en la sala (Fase 4). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ isReady?: boolean }>(request);
  if (typeof body?.isReady !== "boolean") return badRequest("Se requiere isReady (boolean)");

  const server = getSupabaseServerClient(request);
  const { data: room } = await server.from("rooms").select("id").eq("code", code).single();
  if (!room) return notFound("Sala no encontrada");

  const { data: player, error } = await server
    .from("room_players")
    .update({ is_ready: body.isReady })
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return badRequest("No participas en esta sala o error al actualizar");

  return ok({ player });
}
