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
import {
  LogOut,
  ChevronDown,
  Users,
  Sun,
  Moon,
  Laptop,
  Check,
  Download,
  Settings,
} from "lucide-react";
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
    <header className="border-border/80 bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 w-full border-b shadow-2xs backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href={user ? "/groups" : "/"}
            className="group flex items-center gap-2.5 transition-transform active:scale-95"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-base font-black text-white shadow-sm ring-1 ring-black/5 transition-shadow group-hover:shadow-md">
              ₹
            </div>
            <div className="flex items-center gap-2">
              <span className="from-foreground via-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-lg font-extrabold tracking-tight">
                PactTab
              </span>
              <Badge
                variant="outline"
                className="hidden rounded-full border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600 uppercase sm:inline-flex dark:text-emerald-400"
              >
                Zero-Data
              </Badge>
            </div>
          </Link>

          {user && (
            <nav className="hidden items-center gap-1 sm:flex">
              <Link
                href="/groups"
                className="text-foreground hover:bg-muted/80 relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
              >
                <span>Groups</span>
                {pendingAdminActionsCount > 0 && (
                  <span
                    className="relative flex h-2 w-2"
                    title={`${pendingAdminActionsCount} pending request(s) awaiting your approval`}
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="ring-background relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-1" />
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
                  className="border-border/80 bg-card/80 hover:bg-muted/80 focus-visible:ring-ring flex cursor-pointer items-center gap-2 rounded-full border py-1 pr-2.5 pl-1 shadow-2xs transition-all outline-none select-none focus-visible:ring-2"
                >
                  <div className="relative">
                    <UserAvatar username={user.username} size="sm" className="h-6 w-6" />
                    {pendingAdminActionsCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                        <span className="ring-card relative inline-flex h-2 w-2 rounded-full bg-amber-500 ring-1" />
                      </span>
                    )}
                  </div>
                  <span className="text-foreground/90 max-w-[120px] truncate text-xs font-semibold">
                    @{user.username}
                  </span>
                  <ChevronDown className="text-muted-foreground h-3 w-3 transition-transform" />
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="border-border/80 bg-popover w-56 rounded-2xl border p-1.5 shadow-lg"
                >
                  <div className="border-border/60 mb-1 flex items-center gap-2.5 border-b p-2">
                    <UserAvatar username={user.username} size="default" />
                    <div className="min-w-0">
                      <p className="text-foreground truncate text-xs font-bold">@{user.username}</p>
                      <p className="text-muted-foreground truncate text-[10px]">Signed in</p>
                    </div>
                  </div>

                  <Link href="/groups" className="block sm:hidden">
                    <DropdownMenuItem className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <Users className="text-muted-foreground h-3.5 w-3.5" />
                        <span>Your Groups</span>
                      </div>
                      {pendingAdminActionsCount > 0 && (
                        <span className="py-0.2 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          {pendingAdminActionsCount}
                        </span>
                      )}
                    </DropdownMenuItem>
                  </Link>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-xs font-medium">
                      {mounted ? (
                        resolvedTheme === "dark" ? (
                          <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        ) : (
                          <Sun className="h-3.5 w-3.5 text-amber-500" />
                        )
                      ) : (
                        <Sun className="text-muted-foreground h-3.5 w-3.5" />
                      )}
                      <span>Theme</span>
                      <span className="text-muted-foreground mr-1 ml-auto text-[11px] capitalize">
                        {mounted ? theme : "system"}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-36 rounded-xl p-1 shadow-lg">
                      <DropdownMenuItem
                        onClick={() => setTheme("light")}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      >
                        <span className="flex items-center gap-2">
                          <Sun className="h-3.5 w-3.5 text-amber-500" />
                          <span>Light</span>
                        </span>
                        {mounted && theme === "light" && (
                          <Check className="text-foreground ml-auto h-3.5 w-3.5" />
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme("dark")}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      >
                        <span className="flex items-center gap-2">
                          <Moon className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Dark</span>
                        </span>
                        {mounted && theme === "dark" && (
                          <Check className="text-foreground ml-auto h-3.5 w-3.5" />
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setTheme("system")}
                        className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                      >
                        <span className="flex items-center gap-2">
                          <Laptop className="text-muted-foreground h-3.5 w-3.5" />
                          <span>System</span>
                        </span>
                        {mounted && theme === "system" && (
                          <Check className="text-foreground ml-auto h-3.5 w-3.5" />
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator className="my-1" />

                  {isInstallable && (
                    <DropdownMenuItem
                      onClick={install}
                      className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-600 focus:bg-emerald-500/10 focus:text-emerald-600 dark:text-emerald-400 dark:focus:text-emerald-400"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Install App</span>
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => setIsSettingsOpen(true)}
                    className="cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-xs font-medium"
                  >
                    <Settings className="text-muted-foreground h-3.5 w-3.5" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="my-1" />

                  <DropdownMenuItem
                    onClick={handleSignOut}
                    variant="destructive"
                    disabled={isPending}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold"
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
                  className="h-9 cursor-pointer gap-1.5 border-emerald-500/30 px-3 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Install</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger
                  className="border-border/80 bg-card/80 hover:bg-muted/80 text-muted-foreground hover:text-foreground focus-visible:ring-ring flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border shadow-2xs transition-colors outline-none focus-visible:ring-2"
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
                <DropdownMenuContent align="end" className="w-36 rounded-xl p-1 shadow-lg">
                  <DropdownMenuItem
                    onClick={() => setTheme("light")}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sun className="h-3.5 w-3.5 text-amber-500" />
                      <span>Light</span>
                    </span>
                    {mounted && theme === "light" && (
                      <Check className="text-foreground ml-auto h-3.5 w-3.5" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("dark")}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Moon className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Dark</span>
                    </span>
                    {mounted && theme === "dark" && (
                      <Check className="text-foreground ml-auto h-3.5 w-3.5" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme("system")}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Laptop className="text-muted-foreground h-3.5 w-3.5" />
                      <span>System</span>
                    </span>
                    {mounted && theme === "system" && (
                      <Check className="text-foreground ml-auto h-3.5 w-3.5" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-9 px-3.5 text-xs font-semibold">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button
                  size="sm"
                  className="bg-foreground text-background hover:bg-foreground/90 h-9 px-4 text-xs font-semibold shadow-sm"
                >
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
