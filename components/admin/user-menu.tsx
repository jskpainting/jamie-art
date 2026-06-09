"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ExternalLink, LogOut } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { User } from "@supabase/supabase-js"

interface UserMenuProps {
  user: User
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter()
  const initial = user.email?.[0]?.toUpperCase() ?? "?"

  async function handleSignOut() {
    await fetch("/admin/auth/signout", { method: "POST" })
    router.push("/admin/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "w-full justify-start h-auto py-2 px-2 gap-2"
        )}
      >
        {/* Avatar circle */}
        <span className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-xs font-medium text-accent-foreground shrink-0">
          {initial}
        </span>
        <span className="text-xs text-muted-foreground truncate min-w-0">
          {user.email}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-52">
        <DropdownMenuItem>
          <Link
            href="/"
            className="flex items-center gap-2 w-full"
          >
            <ExternalLink className="h-4 w-4" />
            View site
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
