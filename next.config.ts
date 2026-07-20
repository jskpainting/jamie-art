import type { NextConfig } from "next"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    minimumCacheTTL: 31536000,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    remotePatterns: [
      ...(supabaseUrl
        ? [
            {
              protocol: "https" as const,
              hostname: new URL(supabaseUrl).hostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
      { protocol: "https" as const, hostname: "picsum.photos" },
      { protocol: "https" as const, hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [
      {
        // Defense-in-depth security headers on every route.
        source: "/:path*",
        headers: [
          // Block the site from being framed (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Stop MIME-type sniffing.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak full URLs to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Lock down powerful features by default (camera opened explicitly where needed).
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), payment=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
