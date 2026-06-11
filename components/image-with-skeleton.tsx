"use client"

import { useState } from "react"
import Image, { type ImageProps } from "next/image"
import { cn } from "@/lib/utils"

export function ImageWithSkeleton({ className, onLoad, alt, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" aria-hidden="true" />
      )}
      <Image
        alt={alt}
        {...props}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
      />
    </div>
  )
}
