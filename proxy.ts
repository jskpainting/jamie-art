import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"
import { isAllowedAdmin } from "@/lib/supabase/auth"

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  // Only allowlisted admin emails count as authenticated for admin routes.
  const isAdmin = isAllowedAdmin(user?.email)

  const { pathname } = request.nextUrl
  const isAdminPath = pathname.startsWith("/admin")
  const isPublicAdminPath =
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/auth/")

  // Safety net for magic-link sign-in: if the link lands on ANY page carrying
  // auth params (e.g. Supabase redirected to the site root instead of
  // /auth/callback because of a redirect-URL mismatch), route it through the
  // callback handler so the login still completes and ends up at /admin.
  const sp = request.nextUrl.searchParams
  const hasAuthParams =
    sp.has("code") || (sp.has("token_hash") && sp.has("type"))
  if (hasAuthParams && !pathname.startsWith("/auth/callback")) {
    const dest = new URL("/auth/callback", request.url)
    sp.forEach((v, k) => dest.searchParams.set(k, v))
    if (!dest.searchParams.get("next")) dest.searchParams.set("next", "/admin")
    return NextResponse.redirect(dest)
  }

  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ADMIN_AUTH_BYPASS === "true"
  ) {
    return response
  }

  if (isAdminPath && !isPublicAdminPath && !isAdmin) {
    const url = new URL("/admin/login", request.url)
    url.searchParams.set("next", pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Public image files
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
