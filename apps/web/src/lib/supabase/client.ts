import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type BrowserClient = SupabaseClient<any, any>;

let cachedClient: BrowserClient | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

/**
 * Cliente de Supabase para el navegador. RLS de PostgREST aplica aquí.
 * Lazy: no se crea durante el prerender del build de Next.js.
 */
export function getSupabaseClient(): BrowserClient {
  if (!cachedClient) {
    cachedClient = createBrowserClient(
      requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    );
  }
  return cachedClient;
}
