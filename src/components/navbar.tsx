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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LogOut, ChevronDown, Users, Sun, Moon, Laptop, Check, Download, Settings } from "lucide-react";
import { useState, useTransition, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { usePwa } from "@/components/pwa-provider";
import { UserSettingsDialog } from "@/components/user-settings-dialog";

const emptySubscribe = () => () => {};

interface NavbarProps {
  user: {
    id: string;
    username: string;
  } | null;
  pendingAdminActionsCount?: number;
}

export function Navbar({ user, pendingAdminActionsCount = 0 }: NavbarProps) {
  const [isPending, startTransition] = useTransition();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isInstallable, install } = usePwa();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

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
                className="relative text-xs font-semibold px-3 py-1.5 rounded-lg text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1.5"
              >
                <span>Groups</span>
                {pendingAdminActionsCount > 0 && (
                  <span
                    className="relative flex h-2 w-2"
                    title={`${pendingAdminActionsCount} pending request(s) awaiting your approval`}
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 ring-1 ring-background" />
                  </span>
                )}
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={isPending}
                className="flex items-center gap-2 rounded-full border border-border/80 bg-card/80 hover:bg-muted/80 pl-1 pr-2.5 py-1 shadow-2xs transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring select-none"
              >
                <div className="relative">
                  <UserAvatar username={user.username} size="sm" className="h-6 w-6" />
                  {pendingAdminActionsCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 ring-1 ring-card" />
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-foreground/90 max-w-[120px] truncate">
                  @{user.username}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform" />
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                className="w-56 p-1.5 rounded-2xl border border-border/80 bg-popover shadow-lg"
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
                  <DropdownMenuItem className="cursor-pointer flex items-center justify-between py-2 px-2.5 rounded-lg text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Your Groups</span>
                    </div>
                    {pendingAdminActionsCount > 0 && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-1.5 py-0.2">
                        {pendingAdminActionsCount}
                      </span>
                    )}
                  </DropdownMenuItem>
                </Link>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg text-xs font-medium">
                    {mounted ? (
                      resolvedTheme === "dark" ? (
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      ) : (
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                      )
                    ) : (
                      <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span>Theme</span>
                    <span className="ml-auto text-[11px] capitalize text-muted-foreground mr-1">
                      {mounted ? theme : "system"}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-36 p-1 rounded-xl shadow-lg">
                    <DropdownMenuItem
                      onClick={() => setTheme("light")}
                      className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>Light</span>
                      </span>
                      {mounted && theme === "light" && (
                        <Check className="h-3.5 w-3.5 text-foreground ml-auto" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("dark")}
                      className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Dark</span>
                      </span>
                      {mounted && theme === "dark" && (
                        <Check className="h-3.5 w-3.5 text-foreground ml-auto" />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setTheme("system")}
                      className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium"
                    >
                      <span className="flex items-center gap-2">
                        <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>System</span>
                      </span>
                      {mounted && theme === "system" && (
                        <Check className="h-3.5 w-3.5 text-foreground ml-auto" />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator className="my-1" />

                {isInstallable && (
                  <DropdownMenuItem
                    onClick={install}
                    className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 focus:bg-emerald-500/10 focus:text-emerald-600 dark:focus:text-emerald-400"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Install App</span>
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem
                  onClick={() => setIsSettingsOpen(true)}
                  className="cursor-pointer gap-2 py-2 px-2.5 rounded-lg text-xs font-medium"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Account Settings</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1" />

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

            {user && (
              <UserSettingsDialog
                isOpen={isSettingsOpen}
                onOpenChange={setIsSettingsOpen}
                user={user}
              />
            )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              {isInstallable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={install}
                  className="font-semibold text-xs h-9 px-3 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Install</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground shadow-2xs transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Toggle theme"
                >
                  {mounted ? (
                    resolvedTheme === "dark" ? (
                      <Moon className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Sun className="h-4 w-4 text-amber-500" />
                    )
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36 p-1 rounded-xl shadow-lg">
                  <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>Light</span>
                    </span>
                    {mounted && theme === "light" && (
                      <Check className="h-3.5 w-3.5 text-foreground ml-auto" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Dark</span>
                    </span>
                    {mounted && theme === "dark" && (
                      <Check className="h-3.5 w-3.5 text-foreground ml-auto" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className="cursor-pointer flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>System</span>
                    </span>
                    {mounted && theme === "system" && (
                      <Check className="h-3.5 w-3.5 text-foreground ml-auto" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
