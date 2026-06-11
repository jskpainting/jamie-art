import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(cents: number | null): string {
  if (cents === null) return "—"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// Derives a painting title from a filename.
// "Civil Disobedience (1).jpg" → "Civil Disobedience"
// "the_assembly.jpg"           → "The Assembly"
// "Vibrant Decay (1).jpg"      → "Vibrant Decay"
export function cleanFilename(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, "")
  const noNum = noExt.replace(/\s*\(\d+\)\s*$/, "")
  const spaced = noNum.replace(/[_-]+/g, " ")
  const trimmed = spaced.replace(/\s+/g, " ").trim()
  return trimmed
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
}
