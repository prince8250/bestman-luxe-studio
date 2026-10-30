import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";

// Runs before every /pos request (Next.js 16 "proxy", formerly middleware).
// 1. Refreshes the Supabase session cookie, so the counter PC stays signed in
//    through the working day (Server Components cannot write cookies).
// 2. Sends visitors with no session to /pos/login before any POS page renders.
// This is a convenience, not the security boundary: every POS page and server
// action checks the user again on the server (lib/auth), and RLS checks every
// query in the database.
export async function proxy(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // Responses that refresh a session must never be cached.
        for (const [key, value] of Object.entries(cacheHeaders ?? {})) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;
  const isPublicPosPath = pathname === "/pos/login" || pathname.startsWith("/pos/design-check");

  if (!signedIn && !isPublicPosPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/pos/login";
    loginUrl.search = "";
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/pos", "/pos/:path*"],
};
