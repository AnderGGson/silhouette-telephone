import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Confirma el correo de registro. Supabase envía `token_hash` + `type`
 * (PKCE también puede enviar `code`); verificamos la OTP con el cliente SSR
 * para que la sesión quede escrita en cookies y volvemos a /auth.
 */
export async function GET(request: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin).replace(/\/$/, "");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const code = request.nextUrl.searchParams.get("code");

  if (!tokenHash && !code) {
    return NextResponse.redirect(`${appUrl}/auth?error=Enlace de confirmación inválido`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => {
          for (const { name, value, options } of all) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Las cookies solo se pueden escribir en Server Actions/Route Handlers;
              // este es un Route Handler, así que no debería ocurrir.
            }
          }
        },
      },
    },
  );

  let message: string | null = null;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) message = error.message;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) message = error.message;
  }

  return NextResponse.redirect(
    `${appUrl}/auth${message ? `?error=${encodeURIComponent(message)}` : "?confirmed=1"}`,
  );
}
