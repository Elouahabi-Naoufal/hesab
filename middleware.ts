import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as jose from "jose";
import createMiddleware from "next-intl/middleware";
import { routing } from "./src/i18n/routing";

// Lazy (see session.ts): build-time import must not throw; a missing secret
// fails the first real verification instead, loudly.
function getJwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set. Refusing to verify sessions without a secret.");
  }
  return new TextEncoder().encode(s || "dev-only-insecure-secret-change-me");
}

async function verify(token: string) {
  try {
    await jose.jwtVerify(token, getJwtSecret());
    return true;
  } catch {
    return false;
  }
}

const intlMiddleware = createMiddleware(routing);

function stripLocale(pathname: string): { locale: string | null; path: string } {
  const segments = pathname.split("/");
  const maybeLocale = segments[1];
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    const rest = segments.slice(2).join("/");
    return { locale: maybeLocale, path: "/" + rest };
  }
  return { locale: null, path: pathname };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (locale-aware)
  const { locale, path } = stripLocale(pathname);
  if (
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/s/") ||
    path.startsWith("/api/") ||
    path === "/" ||
    path === "/favicon.png" ||
    path === "/logo.png" ||
    path.startsWith("/_next")
  ) {
    return intlMiddleware(request);
  }

  const token = request.cookies.get("session")?.value;
  if (!token || !(await verify(token))) {
    if (path.startsWith("/dashboard") || path.startsWith("/groups") || path.startsWith("/admin")) {
      const loginUrl = new URL(`${locale ? `/${locale}` : ""}/login`, request.url);
      const returnUrl = `${locale ? `/${locale}` : ""}${pathname}`;
      loginUrl.searchParams.set("returnUrl", returnUrl);
      return NextResponse.redirect(loginUrl);
    }
    return intlMiddleware(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
