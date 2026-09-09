import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Split, ArrowRight, Lock } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/groups");
  }

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background Decorative Gradient Orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[500px] w-[700px] -translate-x-1/2 opacity-25 blur-[120px] bg-gradient-to-tr from-emerald-500 via-teal-400 to-indigo-500 dark:opacity-20" />

      {/* Hero Section */}
      <section className="w-full pt-14 pb-12 sm:pt-20 sm:pb-16 px-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-6 shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Zero email • Zero phone numbers • 100% Private</span>
        </div>

        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.15]">
          Split expenses & chat with friends in{" "}
          <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
            closed circles.
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          For trips, flatmates, and dinners. No account verification, no contacts uploaded, and no tracking. Create a group, share a link, and settle up in seconds.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3.5 w-full max-w-xs sm:max-w-md justify-center">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full gap-2 shadow-sm font-bold h-12 px-6 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all hover:scale-[1.02] active:scale-[0.98]">
              Create an Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full h-12 px-6 rounded-xl font-semibold border-border/80 hover:bg-muted/60 transition-all active:scale-[0.98]">
              Sign In
            </Button>
          </Link>
        </div>

        <p className="mt-3.5 text-xs text-muted-foreground font-medium">
          Free forever • No credit cards • 10-second setup
        </p>
      </section>

      {/* Hero Visual Showcase Mockup */}
      <section className="container max-w-3xl px-4 pb-12">
        <div className="relative rounded-2xl border border-border/80 bg-card/80 p-4 sm:p-6 shadow-lg backdrop-blur-sm">
          {/* Mock Header */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-2xs">
                  🌴
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3" title="New unread activity">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-card shadow-xs" />
                </span>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-foreground">Goa Road Trip 2026</h3>
                  <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 border border-emerald-500/20 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">3 members • @maya (admin), @arjun, @rohit</p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">Total Spent</span>
              <span className="text-base sm:text-lg font-black text-foreground">₹4,850.00</span>
            </div>
          </div>

          {/* Mock Content Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-left">
            {/* Recent Expense Card */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-foreground">Beach Shack Seafood</div>
                <div className="text-[11px] text-muted-foreground">Paid by @maya • Split equally</div>
              </div>
              <span className="text-sm font-extrabold text-foreground">₹1,800</span>
            </div>

            {/* Balances Card */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Suggested Settle</div>
                <div className="text-[11px] text-muted-foreground">@arjun pays @maya</div>
              </div>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">₹600.00</span>
            </div>
          </div>

          {/* Mock Chat Pill */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3 flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-bold text-white">
                A
              </span>
              <p className="text-xs text-foreground truncate">
                <strong className="font-semibold">@arjun:</strong> Sent ₹600 via UPI <span className="bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold px-1 rounded-xs">@maya</span>! Let’s head to dinner 🍕
              </p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">Just now</span>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="container max-w-5xl px-4 py-8 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <Card className="border border-border/80 bg-card/70 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all rounded-2xl">
            <CardHeader className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3 shadow-2xs">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Zero Personal Data</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
                Sign up with only a handle and password. No email verification, no phone number harvesting, and zero third-party trackers.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-border/80 bg-card/70 shadow-xs hover:border-teal-500/40 hover:shadow-md transition-all rounded-2xl">
            <CardHeader className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 mb-3 shadow-2xs">
                <Split className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Optimal Balances</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
                Record shared bills and let the algorithm calculate net balances and minimum debt settlement transfers automatically.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border border-border/80 bg-card/70 shadow-xs hover:border-indigo-500/40 hover:shadow-md transition-all rounded-2xl">
            <CardHeader className="p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-3 shadow-2xs">
                <MessageSquare className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Real-Time Chat & @Mentions</CardTitle>
              <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
                Discuss plans, tag group members with autocomplete @mentions, and see financial updates live via WebSockets.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}
