import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<any, any>;

let cachedAdmin: AdminClient | null = null;

/**
 * Cliente con el rol de servicio: SOLO para Route Handlers autoritativos.
 * Se crea sobre demanda (lazy) para no ejecutarse al cargar el módulo
 * durante el build de Next.js sin variables de entorno.
 */
export function getAdminClient(): AdminClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false } },
    );
  }
  return cachedAdmin;
}
