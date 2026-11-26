import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type AdminClient = SupabaseClient<any, any>;

let cachedAdmin: AdminClient | null = null;

/** Variable de entorno obligatoria: error explícito en vez de `undefined!`. */
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/**
 * Cliente con el rol de servicio: SOLO para Route Handlers autoritativos.
 * Lazy para no ejecutarse al cargar el módulo durante el build sin entorno.
 */
export function getAdminClient(): AdminClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }
  return cachedAdmin;
}
