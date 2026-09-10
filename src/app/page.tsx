import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageSquare, Split, ArrowRight, Lock } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/groups");
  }

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background Decorative Gradient Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-500 opacity-25 blur-[120px] dark:opacity-20" />

      {/* Hero Section */}
      <section className="flex w-full flex-col items-center px-4 pt-14 pb-12 text-center sm:pt-20 sm:pb-16">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 shadow-2xs dark:text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          <span>Zero email • Zero phone numbers • 100% Private</span>
        </div>

        <h1 className="text-foreground max-w-3xl text-4xl leading-[1.15] font-black tracking-tight sm:text-5xl md:text-6xl">
          Split expenses & chat with friends in{" "}
          <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
            closed circles.
          </span>
        </h1>

        <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg">
          For trips, flatmates, and dinners. No account verification, no contacts uploaded, and no
          tracking. Create a group, share a link, and settle up in seconds.
        </p>

        <div className="mt-8 flex w-full max-w-xs flex-col justify-center gap-3.5 sm:max-w-md sm:flex-row">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 h-12 w-full gap-2 rounded-xl px-6 font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              Create an Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="border-border/80 hover:bg-muted/60 h-12 w-full rounded-xl px-6 font-semibold transition-all active:scale-[0.98]"
            >
              Sign In
            </Button>
          </Link>
        </div>

        <p className="text-muted-foreground mt-3.5 text-xs font-medium">
          Free forever • No credit cards • 10-second setup
        </p>
      </section>

      {/* Hero Visual Showcase Mockup */}
      <section className="container max-w-3xl px-4 pb-12">
        <div className="border-border/80 bg-card/80 relative rounded-2xl border p-4 shadow-lg backdrop-blur-sm sm:p-6">
          {/* Mock Header */}
          <div className="border-border/60 mb-4 flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-sm font-bold text-white shadow-2xs">
                  🌴
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3" title="New unread activity">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="ring-card relative inline-flex h-3 w-3 rounded-full bg-emerald-500 shadow-xs ring-2" />
                </span>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-sm font-bold sm:text-base">
                    Goa Road Trip 2026
                  </h3>
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <div className="flex -space-x-1.5 overflow-hidden">
                    <UserAvatar username="maya" size="xs" className="border-background h-4 w-4" />
                    <UserAvatar username="arjun" size="xs" className="border-background h-4 w-4" />
                    <UserAvatar username="rohit" size="xs" className="border-background h-4 w-4" />
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    3 members • @maya (admin), @arjun, @rohit
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-muted-foreground block text-[11px] font-semibold tracking-wider uppercase">
                Total Spent
              </span>
              <span className="text-foreground text-base font-black sm:text-lg">₹4,850.00</span>
            </div>
          </div>

          {/* Mock Content Rows */}
          <div className="mb-4 grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            {/* Recent Expense Card */}
            <div className="border-border/60 bg-muted/30 flex items-center justify-between rounded-xl border p-3">
              <div>
                <div className="text-foreground text-xs font-bold">Beach Shack Seafood</div>
                <div className="text-muted-foreground text-[11px]">
                  Paid by @maya • Split equally
                </div>
              </div>
              <span className="text-foreground text-sm font-extrabold">₹1,800</span>
            </div>

            {/* Balances Card */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
              <div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Suggested Settle
                </div>
                <div className="text-muted-foreground text-[11px]">@arjun pays @maya</div>
              </div>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹600.00
              </span>
            </div>
          </div>

          {/* Mock Chat Pill */}
          <div className="border-border/60 bg-muted/40 flex items-center justify-between gap-3 rounded-xl border p-3 text-left">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">
                A
              </span>
              <p className="text-foreground truncate text-xs">
                <strong className="font-semibold">@arjun:</strong> Sent ₹600 via UPI{" "}
                <span className="rounded-xs bg-amber-500/20 px-1 font-bold text-amber-900 dark:text-amber-200">
                  @maya
                </span>
                ! Let’s head to dinner 🍕
              </p>
            </div>
            <span className="text-muted-foreground shrink-0 text-[10px]">Just now</span>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="container mb-16 max-w-5xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-3">
          <Card className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
            <CardHeader className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs dark:text-emerald-400">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Zero Personal Data</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                Sign up with only a handle and password. No email verification, no phone number
                harvesting, and zero third-party trackers.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:border-teal-500/40 hover:shadow-md">
            <CardHeader className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 shadow-2xs dark:text-teal-400">
                <Split className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Optimal Balances</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                Record shared bills and let the algorithm calculate net balances and minimum debt
                settlement transfers automatically.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:border-indigo-500/40 hover:shadow-md">
            <CardHeader className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 shadow-2xs dark:text-indigo-400">
                <MessageSquare className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Real-Time Chat & @Mentions</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                Discuss plans, tag group members with autocomplete @mentions, and see financial
                updates live via WebSockets.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}
