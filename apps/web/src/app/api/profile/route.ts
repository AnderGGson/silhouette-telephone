import { NextRequest } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isValidAvatarConfig } from "@silhouette/shared-types";
import type { AvatarConfig, ProfileRow } from "@silhouette/shared-types";
import { badRequest, notFound, ok, parseJson, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

/**
 * Actualiza el perfil del usuario autenticado (según RLS: solo su propia fila):
 * `username` (2–24) y/o `avatar_config` (validada).
 */
export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await parseJson<{ username?: string; avatar_config?: AvatarConfig }>(request);
  if (!body) return badRequest("Cuerpo inválido");

  const updates: { username?: string; avatar_config?: AvatarConfig } = {};
  if (body.username !== undefined) {
    const username = body.username.trim();
    if (username.length < 2 || username.length > 24) {
      return badRequest("El nombre de usuario debe tener entre 2 y 24 caracteres");
    }
    updates.username = username;
  }
  if (body.avatar_config !== undefined) {
    if (!isValidAvatarConfig(body.avatar_config)) {
      return badRequest("avatar_config inválido");
    }
    updates.avatar_config = body.avatar_config;
  }
  if (Object.keys(updates).length === 0) return badRequest("Debe enviar username y/o avatar_config");

  const server = getSupabaseServerClient(request);
  const { data: profile } = await server
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  if (!profile) return notFound("Perfil no encontrado");

  const { error } = await server.from("profiles").update(updates).eq("id", user.id);
  if (error) return badRequest("Error actualizando el perfil");

  const { data: updated } = await server.from("profiles").select("*").eq("id", user.id).single();
  return ok({ profile: updated as ProfileRow | null });
}
