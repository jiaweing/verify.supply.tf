import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isAdminPath = request.nextUrl.pathname.startsWith("/admin");
  const isLoginPath = request.nextUrl.pathname === "/admin/login";
  const adminToken = request.cookies.get("admin_token");

  if (isAdminPath) {
    // Allow access to login page when not authenticated
    if (!adminToken && !isLoginPath) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    // Redirect to admin dashboard if already authenticated and trying to access login
    if (adminToken && isLoginPath) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
