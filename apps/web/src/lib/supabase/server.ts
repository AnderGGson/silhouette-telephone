import { createServerClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el servidor (Route Handlers).
 * La sesión se lee de la cabecera `cookie` de la petición entrante; así se
 * valida la identidad del usuario en cada llamada sin depender de caché global.
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
      },
    },
  );
}
