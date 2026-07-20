import type { Metadata, Viewport } from "next"
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { JsonLd } from "@/components/json-ld"
import {
  SITE_URL,
  SITE_NAME,
  ARTIST_NAME,
  INSTAGRAM_URL,
  OG_IMAGE_PATH,
  absoluteUrl,
} from "@/lib/site"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600", "700"],
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s — Jamie Kendrioski",
    default: "Jamie Kendrioski — Boston Painter | Original Oil & Acrylic Paintings",
  },
  description:
    "Jamie Kendrioski is a Boston-based painter working in oils and acrylics. Explore original abstracts, cityscapes, seascapes, florals, and Pixels & Rainbows — with commissions and prints available.",
  keywords: [
    "Jamie Kendrioski",
    "Boston painter",
    "Boston artist",
    "original paintings",
    "oil paintings",
    "acrylic paintings",
    "abstract art",
    "cityscape paintings",
    "seascape paintings",
    "floral paintings",
    "contemporary art Boston",
    "buy original art",
    "art commissions Boston",
  ],
  authors: [{ name: ARTIST_NAME, url: SITE_URL }],
  creator: ARTIST_NAME,
  publisher: ARTIST_NAME,
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Jamie K",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    title: "Jamie Kendrioski — Boston Painter",
    description:
      "Original oil and acrylic paintings by Boston artist Jamie Kendrioski — abstracts, cityscapes, seascapes, and florals.",
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: "Jamie Kendrioski — Boston painter",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jamie Kendrioski — Boston Painter",
    description:
      "Original oil and acrylic paintings by Boston artist Jamie Kendrioski.",
    images: [OG_IMAGE_PATH],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF7" },
    { media: "(prefers-color-scheme: dark)", color: "#0F0F0E" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Person",
              "@id": `${SITE_URL}/#person`,
              name: ARTIST_NAME,
              jobTitle: "Painter",
              description:
                "Boston-based painter working in oils and acrylics — abstracts, cityscapes, seascapes, florals, and Pixels & Rainbows.",
              url: SITE_URL,
              image: absoluteUrl(OG_IMAGE_PATH),
              sameAs: [INSTAGRAM_URL],
              address: {
                "@type": "PostalAddress",
                addressLocality: "Boston",
                addressRegion: "MA",
                addressCountry: "US",
              },
              knowsAbout: [
                "Oil painting",
                "Acrylic painting",
                "Abstract art",
                "Cityscape painting",
                "Seascape painting",
                "Floral painting",
              ],
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": `${SITE_URL}/#website`,
              name: SITE_NAME,
              url: SITE_URL,
              inLanguage: "en-US",
              publisher: { "@id": `${SITE_URL}/#person` },
            },
          ]}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
