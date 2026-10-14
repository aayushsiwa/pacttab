import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const isProtected = ["/groups", "/settings", "/onboarding", "/group"].some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (
    (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup") &&
    sessionCookie
  ) {
    return NextResponse.redirect(new URL("/groups", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
