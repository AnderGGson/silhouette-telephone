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
import {
  badRequest,
  conflict,
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

  // El host debe tener perfil: rooms.host_id tiene FK a profiles(id).
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (profileError || !profile) {
    return conflict(
      "Tu usuario no tiene perfil. Cierra sesión y vuelve a entrar para que se cree automáticamente.",
    );
  }

  const { data: code, error: codeError } = await admin.rpc("generate_unique_room_code");
  if (codeError || typeof code !== "string" || !code) {
    return serverError(
      "No se pudo generar el código de sala",
      codeError?.message ?? "generate_unique_room_code() no devolvió un código",
    );
  }

  const { data: room, error: roomError } = await admin
    .from("rooms")
    .insert({ code, host_id: user.id, settings })
    .select("*")
    .single();
  if (roomError || !room) {
    return serverError("Error creando la sala", roomError?.message);
  }
  const roomRow = room as RoomRow;

  const { error: playerError } = await admin.from("room_players").insert({
    room_id: roomRow.id,
    user_id: user.id,
    seat_index: 0,
    is_ready: false,
    is_connected: true,
  });
  if (playerError) {
    return serverError("Error añadiéndote como jugador", playerError.message);
  }

  const { error: messageError } = await admin.from("room_messages").insert({
    room_id: roomRow.id,
    user_id: null,
    is_system: true,
    content: `Sala ${roomRow.code} creada. Únete con el código.`,
  });
  if (messageError) {
    console.error("[api] Error en mensaje de sistema de sala", messageError.message);
  }

  return ok({ room: roomRow, code: roomRow.code });
}
