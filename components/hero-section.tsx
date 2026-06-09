"use client"

import Link from "next/link"
import { motion, useReducedMotion, type Transition } from "framer-motion"

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
}

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion()

  const transition: Transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.4, ease: "easeOut" }

  return (
    <section className="relative flex flex-col justify-center min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-6 md:px-10 py-20 md:py-32">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.1 } },
        }}
        className="max-w-3xl"
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
          className="text-lg md:text-xl leading-relaxed text-muted-foreground mb-10 max-w-xl"
        >
          Original paintings where light and texture tell the story.
        </motion.p>

        <motion.div variants={fadeUp} transition={transition}>
          <Link
            href="/portfolio"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground border border-border rounded-lg px-5 h-10 hover:bg-muted transition-colors"
          >
            View Portfolio →
          </Link>
        </motion.div>
      </motion.div>
    </section>
  )
}
