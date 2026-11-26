import type { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS,
  validateRoomSettings,
  type RoomSettingsJson,
  type RoomRow,
} from "@silhouette/shared-types";
import { badRequest, ok, parseJson, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ settings?: Partial<RoomSettingsJson> }>(request);
  const settings = {
    ...DEFAULT_ROOM_SETTINGS,
    ...(body?.settings ?? {}),
  } as RoomSettingsJson;
  const settingsErrors = validateRoomSettings(settings);
  if (settingsErrors.length > 0) {
    return badRequest(
      `Configuración inválida: ${settingsErrors.map((e) => e.message).join("; ")}`,
    );
  }

  const code = (await getAdminClient().rpc("generate_unique_room_code")).data;
  if (!code) return new Response("Error generando código de sala", { status: 500 });

  const { data: room } = await getAdminClient()
    .from("rooms")
    .insert({ code, host_id: user.id, settings })
    .select("*")
    .single();

  if (!room) {
    return new Response("Error creando la sala", { status: 500 });
  }
  const roomRow = room as RoomRow;

  await getAdminClient()
    .from("room_players")
    .insert({
      room_id: roomRow.id,
      user_id: user.id,
      seat_index: 0,
      is_ready: false,
      is_connected: true,
    })
    .select("*")
    .single();

  await getAdminClient().from("room_messages").insert({
    room_id: roomRow.id,
    user_id: null,
    is_system: true,
    content: `Sala ${roomRow.code} creada. Únete con el código.`,
  });

  return ok({ room: roomRow, code: roomRow.code });
}
