import type { NextConfig } from "next"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
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
}

export default nextConfig
