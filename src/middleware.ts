import { NextResponse, type NextRequest } from "next/server";
import { env } from "./env.mjs";
import { apiRateLimiter, authRateLimiter } from "./lib/rate-limit";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // CORS headers
  response.headers.set("Access-Control-Allow-Origin", env.NEXT_PUBLIC_APP_URL);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "86400"); // 24 hours

  // CSP headers
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com", // Required for Next.js and Turnstile
      "style-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "img-src 'self' data: https: https://challenges.cloudflare.com",
      "font-src 'self' https://challenges.cloudflare.com",
      "connect-src 'self' https://challenges.cloudflare.com https://*.turnstile.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'none'", // Prevent clickjacking
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; ")
  );

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  // Apply rate limiting for authentication endpoints
  if (request.nextUrl.pathname.startsWith("/admin/login")) {
    const rateLimitResult = await authRateLimiter.check(request, 20);
    if (!rateLimitResult.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (rateLimitResult.reset.getTime() - Date.now()) / 1000
          ).toString(),
        },
      });
    }
  }

  // Apply rate limiting for API endpoints
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const rateLimitResult = await apiRateLimiter.check(request, 100);
    if (!rateLimitResult.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (rateLimitResult.reset.getTime() - Date.now()) / 1000
          ).toString(),
        },
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
