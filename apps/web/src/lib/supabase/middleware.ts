import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Actualiza la sesión de Supabase por middleware (refresh de cookies).
 * Se ejecuta en cada petición para mantener la sesión activa.
 */
export async function updateSession(request: Request): Promise<Response> {
  const cookiesFromHeader = request.headers.get("cookie");
  const cookies = new Map<string, string>();
  if (cookiesFromHeader) {
    for (const part of cookiesFromHeader.split(";")) {
      const idx = part.indexOf("=");
      if (idx > -1) {
        const name = part.slice(0, idx).trim();
        if (name) cookies.set(name, part.slice(idx + 1).trim());
      }
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      },
    },
  );

  try {
    await supabase.auth.getSession();
  } catch {
    // La sesión no está disponible; proseguimos sin cambios.
  }

  return NextResponse.next();
}
