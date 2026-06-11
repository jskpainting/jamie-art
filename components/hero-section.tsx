"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion, type Transition } from "framer-motion"
import { buttonVariants } from "@/components/ui/button"
import type { Painting } from "@/lib/types"

interface HeroSectionProps {
  painting: Painting | null
  bioTeaser: string | null
}

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

export function HeroSection({ painting, bioTeaser }: HeroSectionProps) {
  const shouldReduceMotion = useReducedMotion()

  const transition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: "easeOut" }

  return (
    <section className="relative flex flex-col md:grid md:grid-cols-[60%_40%] min-h-[calc(100vh-4rem)]">
      {/* Image column */}
      <div className="relative h-[60vh] md:h-auto">
        {painting?.primary_image_url ? (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.6 }}
          >
            <Image
              src={painting.primary_image_url}
              alt={painting.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 60vw"
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <p className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground">
              Featured painting coming soon
            </p>
          </div>
        )}
      </div>

      {/* Text column */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="flex flex-col justify-center px-8 md:px-12 py-16 md:py-20 min-h-[50vh] md:min-h-0"
      >
        <motion.p
          variants={fadeUp}
          transition={transition}
          className="text-xs uppercase tracking-[0.2em] font-medium text-muted-foreground mb-6"
        >
          Painter · Boston · Oils &amp; Acrylics
        </motion.p>

        <motion.h1
          variants={fadeUp}
          transition={transition}
          className="text-5xl md:text-7xl tracking-tight font-light font-serif mb-6 text-foreground"
        >
          Jamie Kendrioski
        </motion.h1>

        <motion.p
          variants={fadeUp}
          transition={transition}
          className="text-base md:text-lg leading-relaxed text-muted-foreground mb-10"
        >
          {bioTeaser || "Original paintings where light and texture tell the story."}
        </motion.p>

        <motion.div
          variants={fadeUp}
          transition={transition}
          className="flex gap-3 flex-wrap"
        >
          <Link href="/portfolio" className={buttonVariants()}>
            View Portfolio
          </Link>
          <Link href="/contact" className={buttonVariants({ variant: "outline" })}>
            Get in touch
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
