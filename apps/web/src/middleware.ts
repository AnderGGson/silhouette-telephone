import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

export default function middleware(request: NextRequest): Response | Promise<Response> {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skips Next.js internals, static assets, images and API routes:
    "/((?!_next|_vercel|\\.next|static|favicon\\.ico|robots\\.txt|manifest\\.json).*)",
  ],
};
