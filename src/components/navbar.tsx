"use client";

import Link from "next/link";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, ChevronDown, Users } from "lucide-react";
import { useTransition } from "react";

interface NavbarProps {
  user: {
    id: string;
    username: string;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOutAction();
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-2xs">
      <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href={user ? "/groups" : "/"} className="group flex items-center gap-2.5 transition-transform active:scale-95">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white font-black text-base shadow-sm ring-1 ring-black/5 group-hover:shadow-md transition-shadow">
              ₹
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text">
                PactTab
              </span>
              <Badge
                variant="outline"
                className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full"
              >
                Zero-Data
              </Badge>
            </div>
          </Link>

          {user && (
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/groups"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground hover:bg-muted/80 transition-colors"
              >
                Groups
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isPending}
                className="flex items-center gap-2 rounded-full border border-border/80 bg-card/80 hover:bg-muted/80 pl-1 pr-2.5 py-1 shadow-2xs transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
              >
                <UserAvatar username={user.username} size="sm" className="h-6 w-6" />
                <span className="text-xs font-semibold text-foreground/90 max-w-[120px] truncate">
                  @{user.username}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-52 p-1.5 rounded-2xl border border-border/80 bg-popover shadow-lg"
              >
                <div className="flex items-center gap-2.5 p-2 border-b border-border/60 mb-1">
                  <UserAvatar username={user.username} size="default" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">
                      @{user.username}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Signed in
                    </p>
                  </div>
                </div>

                <Link href="/groups" className="block sm:hidden">
                  <DropdownMenuItem className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg text-xs font-medium">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Your Groups</span>
                  </DropdownMenuItem>
                </Link>

                <DropdownMenuItem
                  onClick={handleSignOut}
                  variant="destructive"
                  disabled={isPending}
                  className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg text-xs font-semibold text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-semibold text-xs h-9 px-3.5">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="font-semibold text-xs h-9 px-4 shadow-sm bg-foreground text-background hover:bg-foreground/90">
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
