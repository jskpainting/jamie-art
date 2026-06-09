import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const { pathname } = request.nextUrl
  const isAdminPath = pathname.startsWith("/admin")
  const isPublicAdminPath =
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/auth/")

  if (isAdminPath && !isPublicAdminPath && !user) {
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
