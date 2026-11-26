import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MIN_PLAYERS, MAX_PLAYERS, type RoomRow } from "@silhouette/shared-types";
import { conflict, forbidden, notFound, ok, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

export async function POST(
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

  if (roomRow.host_id !== user.id) return forbidden();
  if (roomRow.status !== "LOBBY") return conflict("La sala ya está en curso");

  const { count } = await server
    .from("room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomRow.id);

  if (count === null || count < MIN_PLAYERS || count > MAX_PLAYERS) {
    return conflict(`Debe haber entre ${MIN_PLAYERS} y ${MAX_PLAYERS} jugadores en la sala`);
  }

  const { data: updated } = await getAdminClient()
    .from("rooms")
    .update({
      status: "CONCEPT_SUBMISSION",
      step_ends_at: new Date(Date.now() + (roomRow.settings.conceptSubmissionSeconds ?? 20) * 1000).toISOString(),
    })
    .eq("id", roomRow.id)
    .select("*")
    .single();

  return ok({ room: (updated as RoomRow) ?? roomRow });
}
