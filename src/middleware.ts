import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/ask", "/connect", "/settings"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!isProtected) return NextResponse.next();

  const response = NextResponse.next();
  // Prevent browser from caching authenticated pages so back button after
  // logout does not restore a stale authenticated view.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export const config = {
  matcher: ["/ask/:path*", "/connect/:path*", "/settings/:path*"],
};
