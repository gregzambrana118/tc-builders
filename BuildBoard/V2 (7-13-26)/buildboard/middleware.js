import { NextResponse } from "next/server";
 
/**
 * Edge-safe auth routing. No Supabase imports here — the Edge runtime
 * lacks Node globals that the Supabase client's dependencies expect.
 * This only handles UX routing (send signed-out visitors to /login);
 * real access control is enforced by Postgres Row-Level Security.
 */
export function middleware(request) {
  const hasSessionCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token") && c.value);
 
  const isLogin = request.nextUrl.pathname.startsWith("/login");
 
  if (!hasSessionCookie && !isLogin) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
 
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.png$).*)"],
};
