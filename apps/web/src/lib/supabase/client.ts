import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserClient = SupabaseClient<any, any>;

let cachedClient: BrowserClient | null = null;

/**
 * Cliente de Supabase para el navegador (Fase 3 / configuración inicial).
 * Las políticas RLS de PostgREST aplican aquí.
 */
export function getSupabaseClient(): BrowserClient {
  if (!cachedClient) {
    cachedClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return cachedClient;
}
