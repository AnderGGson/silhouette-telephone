import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

/**
 * Cliente de Supabase para Route Handlers. Lee la sesión de las cookies de la
 * petición; `setAll` mantiene cualquier refresco dentro de la petición (el
 * middleware se encarga de propagar las cookies refrescadas a la respuesta).
 */
export function getSupabaseServerClient(request: Request) {
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

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
        setAll: (all: { name: string; value: string; options?: CookieOptions }[]) => {
          for (const { name, value } of all) {
            if (value === "") cookies.delete(name);
            else cookies.set(name, value);
          }
        },
      },
    },
  );
}
