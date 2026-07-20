import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isSelfAuthenticatedCronApi } from "@/lib/api/cron-auth";

const PUBLIC_PATHS = ["/login", "/api/branding"];

function isSyntraPublicRoute(pathname: string): boolean {
  return pathname === "/api/syntra/auth/login";
}

function isSyntraDeviceRoute(pathname: string): boolean {
  return pathname.startsWith("/api/syntra/");
}

function isNextAuthPublicRoute(pathname: string): boolean {
  if (!pathname.startsWith("/api/auth/")) return false;
  if (pathname === "/api/auth/change-password") return false;
  return true;
}

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    isNextAuthPublicRoute(pathname)
  );
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isNextAuthPublicRoute(pathname)) {
    if (pathname.includes("callback")) {
      const ip = clientIp(req);
      const rl = checkRateLimit(`auth:${ip}`, 20, 60_000);
      if (!rl.ok) {
        return NextResponse.json(
          { error: { message: "Demasiados intentos. Espere e intente de nuevo." } },
          {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfterSec) },
          },
        );
      }
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/branding")) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return NextResponse.json({ error: { message: "Método no permitido" } }, { status: 405 });
    }
    return NextResponse.next();
  }

  // SYNTRA móvil: login público; resto autenticado con Bearer JWT en el handler.
  if (isSyntraPublicRoute(pathname)) {
    return NextResponse.next();
  }
  if (isSyntraDeviceRoute(pathname)) {
    return NextResponse.next();
  }

  // Cron del VPS: auth Bearer en el handler (empleados NAF, FE, cobro, etc.).
  if (isSelfAuthenticatedCronApi(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.sub) {
      return NextResponse.json({ error: { message: "No autenticado" } }, { status: 401 });
    }
  }

  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next") &&
    !pathname.startsWith("/favicon") &&
    pathname !== "/login"
  ) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token?.sub && (pathname.startsWith("/home") || pathname.startsWith("/admin") || pathname.startsWith("/contracts") || pathname.startsWith("/expenses") || pathname.startsWith("/disciplinario") || pathname.startsWith("/inventory") || pathname.startsWith("/reports") || pathname.startsWith("/dashboard") || pathname.startsWith("/sig") || pathname.startsWith("/recorridos"))) {
      const login = new URL("/login", req.url);
      login.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/home/:path*",
    "/admin/:path*",
    "/contracts/:path*",
    "/expenses/:path*",
    "/disciplinario/:path*",
    "/inventory/:path*",
    "/reports/:path*",
    "/dashboard/:path*",
    "/sig/:path*",
    "/recorridos/:path*",
  ],
};
