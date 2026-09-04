import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production-use-long-random-string-32-chars-min";
const secret = new TextEncoder().encode(JWT_SECRET);

async function verify(token: string) {
  try {
    await jose.jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

const publicPaths = ["/login", "/register", "/s", "/api", "/_next", "/favicon.ico", "/", "/public"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/s/") ||
    pathname.startsWith("/api/") ||
    pathname === "/" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;
  if (!token || !(await verify(token))) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/groups") || pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
