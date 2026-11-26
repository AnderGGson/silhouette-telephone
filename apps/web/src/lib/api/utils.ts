import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../supabase/server";

/** Valida la identidad de la petición (sesión activa). */
export async function requireUser(request: Request) {
  const server = getSupabaseServerClient(request);
  const { data, error } = await server.auth.getUser();
  if (error || !data) return null;
  return data.user;
}

export const MAX_CONCEPT_LENGTH = 60;
export const MAX_GUESS_LENGTH = 80;
export const MAX_MESSAGE_LENGTH = 280;
export const GUESS_TEXT_MIN_LENGTH = 1;

/** Código de sala: 6 caracteres, alfabético sin 0/O/I/L (generado por `generate_unique_room_code()`). */
export const ROOM_CODE_PATTERN = /^[A-Z2-9]{6}$/;

export function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && ROOM_CODE_PATTERN.test(value.trim());
}

export function ok(body: unknown, status = 200): Response {
  return NextResponse.json(body, { status });
}

export function badRequest(message: string): Response {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function unauthorized(): Response {
  return NextResponse.json({ error: "No autenticado" }, { status: 401 });
}

export function forbidden(): Response {
  return NextResponse.json({ error: "No autorizado" }, { status: 403 });
}

export function notFound(message = "No encontrado"): Response {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string): Response {
  return NextResponse.json({ error: message }, { status: 409 });
}

export async function parseJson<T = Record<string, unknown>>(
  request: Request,
): Promise<T | null> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null) return null;
    return body as T;
  } catch {
    return null;
  }
}

/** Valida una cadena de longitud mínima y sin espacios excesivos. */
export function validateText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) return null;
  return trimmed;
}
