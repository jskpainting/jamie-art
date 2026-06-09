import type { NextConfig } from "next"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

const nextConfig: NextConfig = {
  images: {
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
