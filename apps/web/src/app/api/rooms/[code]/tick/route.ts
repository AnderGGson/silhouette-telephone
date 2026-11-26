import type { NextRequest } from "next/server";
import { tickRoom } from "@/lib/game/tick";
import { notFound, ok, requireUser, unauthorized } from "@/lib/api/utils";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof (body as { roomId?: unknown }).roomId !== "string") {
    return Response.json({ error: "Se requiere roomId" }, { status: 400 });
  }

  const result = await tickRoom((body as { roomId: string }).roomId);
  if (!result.ok) return notFound("Sala no encontrada");
  return ok(result);
}
