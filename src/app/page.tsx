import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  MessageSquare,
  Split,
  ArrowRight,
  Lock,
  Server,
  EyeOff,
  KeyRound,
  Check,
  X,
  Users,
  Receipt,
  Handshake,
  Utensils,
  Home,
  CalendarDays,
  Gift,
  Coins,
} from "lucide-react";

const useCases = [
  { icon: Utensils, label: "Dinners" },
  { icon: Home, label: "Flatmates" },
  { icon: CalendarDays, label: "Road trips" },
  { icon: Gift, label: "Weddings & parties" },
  { icon: Coins, label: "Cash rounds" },
];

const compareRows = [
  {
    ours: [
      "Sign-up that respects you",
      "Handle + password, in seconds. No email, no phone, no verification loop.",
    ],
    theirs: [
      "Email verification, often a phone number.",
      "Every friend you add is more personal data inside the platform.",
    ],
  },
  {
    ours: [
      "Free forever, no bait",
      "Every feature, no paywall. No ad feed dropped between you and your money.",
    ],
    theirs: [
      "Ads on the free tier",
      "And premium upgrades for what should be the baseline experience.",
    ],
  },
  {
    ours: [
      "Real-time chat, built in",
      "Settle up discussions and @mentions in the same thread as the money.",
    ],
    theirs: [
      "Messaging on the side",
      "Chat lives on the periphery instead of inside your group's flow.",
    ],
  },
  {
    ours: [
      "Open source & self-hostable",
      "Audit the code, run it on your own server, own your data forever.",
    ],
    theirs: [
      "Closed source SaaS",
      "Your balances sit in a black box on someone else's infrastructure.",
    ],
  },
  {
    ours: [
      "Deletion that actually deletes",
      "Remove your account and everything goes with you. For real.",
    ],
    theirs: ["Data that lingers", "History and profiles can survive long after you leave."],
  },
];

const steps = [
  {
    icon: Users,
    step: "01",
    title: "Create a closed circle",
    description:
      "Form a group, share a link with a password. No contacts to upload, no invites to await — just your people.",
  },
  {
    icon: Receipt,
    step: "02",
    title: "Track every bill",
    description:
      "Add expenses split equally, by amount, or by your own weights. The algorithm nets everyone's balance to the minimum transfers.",
  },
  {
    icon: Handshake,
    step: "03",
    title: "Settle up in one tap",
    description:
      "Get the cleanest debt-settlement plan and coordinate payments in a real-time chat that lives right next to the numbers.",
  },
];

const githubMark = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/groups");
  }

  return (
    <div className="relative flex flex-col items-center overflow-hidden">
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
          <Link href="#how-it-works" className="w-full sm:w-auto">
            <Button
              size="lg"
              variant="outline"
              className="border-border/80 hover:bg-muted/60 h-12 w-full rounded-xl px-6 font-semibold transition-all active:scale-[0.98]"
            >
              How it works
            </Button>
          </Link>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          <p className="text-muted-foreground text-xs font-medium">
            Free forever • No credit cards • 10-second setup
          </p>
          <div className="flex -space-x-1.5 overflow-hidden">
            <UserAvatar username="maya" size="xs" className="ring-background h-5 w-5 ring-2" />
            <UserAvatar username="arjun" size="xs" className="ring-background h-5 w-5 ring-2" />
            <UserAvatar username="rohit" size="xs" className="ring-background h-5 w-5 ring-2" />
            <UserAvatar username="priya" size="xs" className="ring-background h-5 w-5 ring-2" />
          </div>
        </div>
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

      {/* Built For Use-Cases */}
      <section className="container mb-16 max-w-5xl px-4">
        <p className="text-muted-foreground mb-4 text-center text-xs font-semibold tracking-wider uppercase">
          Made for the circles you actually share money with
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {useCases.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="border-border/60 bg-card/70 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="scroll-mt-24">
        <div className="container mb-16 max-w-5xl px-4 py-8">
          <div className="mb-10 text-center">
            <span className="border-border/80 bg-card/70 text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3.5 py-1 text-xs font-semibold shadow-xs">
              How it works
            </span>
            <h2 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
              From awkward IOUs to{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
                settled in seconds.
              </span>
            </h2>
          </div>

          <div className="relative grid grid-cols-1 gap-6 text-left md:grid-cols-3">
            {steps.map(({ icon: Icon, step, title, description }) => (
              <Card
                key={step}
                className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md"
              >
                <CardHeader className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-foreground/30 font-mono text-lg font-black">{step}</span>
                  </div>
                  <CardTitle className="text-lg font-bold">{title}</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="container mb-16 max-w-5xl px-4 py-8">
        <div className="mb-10 text-center">
          <h2 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
            Everything Splitwise does…
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-sm leading-relaxed">
            …minus the data harvesting, the ads, and the sign-up bureaucracy. Plus a few things it
            never bothered to build.
          </p>
        </div>

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

      {/* Comparison vs Splitwise */}
      <section className="container mb-16 max-w-5xl px-4 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
            Built to fix what{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
              split apps get wrong.
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-sm leading-relaxed">
            The basics shouldn&apos;t be locked behind a premium plan, and your friendships
            shouldn&apos;t be the product.
          </p>
        </div>

        <div className="border-border/80 bg-card/70 overflow-hidden rounded-2xl border shadow-md">
          {/* Column Headers */}
          <div className="border-border/70 bg-muted/40 grid grid-cols-2 border-b">
            <div className="flex items-center gap-2.5 px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-sm font-black text-white shadow-sm">
                ₹
              </div>
              <div className="text-left">
                <div className="text-foreground text-sm font-extrabold">PactTab</div>
                <div className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                  Open source
                </div>
              </div>
            </div>
            <div className="border-border/70 flex items-center gap-2.5 border-l px-5 py-4">
              <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-black">
                S
              </div>
              <div className="text-left">
                <div className="text-muted-foreground text-sm font-extrabold">Splitwise</div>
                <div className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
                  Closed SaaS
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Rows */}
          {compareRows.map(({ ours, theirs }, i) => (
            <div
              key={i}
              className={`grid grid-cols-2 ${i % 2 === 0 ? "bg-transparent" : "bg-muted/25"} ${i === compareRows.length - 1 ? "" : "border-border/50 border-b"}`}
            >
              <div className="flex flex-col gap-0.5 px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <div className="min-w-0 text-left">
                    <div className="text-foreground text-xs font-bold">{ours[0]}</div>
                    <div className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                      {ours[1]}
                    </div>
                  </div>
                </div>
              </div>
              <div className="border-border/50 flex flex-col gap-0.5 border-l px-5 py-4">
                <div className="flex items-start gap-2.5">
                  <span className="bg-muted text-muted-foreground mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <X className="h-3 w-3" strokeWidth={3} />
                  </span>
                  <div className="min-w-0 text-left">
                    <div className="text-muted-foreground text-xs font-bold">{theirs[0]}</div>
                    <div className="text-muted-foreground/70 mt-0.5 text-[11px] leading-relaxed">
                      {theirs[1]}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-4 text-center text-[11px]">
          Feature comparisons based on Splitwise&apos;s public product and pricing. The PactTab
          column is guaranteed — by open source.
        </p>
      </section>

      {/* Self-Hosting & Privacy */}
      <section className="container mb-16 max-w-5xl px-4 py-8">
        <div className="mb-8 text-center">
          <h2 className="text-foreground text-2xl font-black tracking-tight sm:text-3xl">
            Your money. Your server.{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
              Your rules.
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-2xl text-sm leading-relaxed">
            PactTab is fully open source and built privacy-first from day one — no sneaky defaults,
            no data resale, no dark patterns. Self-host it or trust the public instance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 text-left md:grid-cols-3">
          <Card className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
            <CardHeader className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shadow-2xs dark:text-emerald-400">
                <Server className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Self-Hostable & Open Source</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                Run the entire app on your own infrastructure with a single command. Full code
                auditability on GitHub — no black boxes, ever.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:border-teal-500/40 hover:shadow-md">
            <CardHeader className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 shadow-2xs dark:text-teal-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Encrypted Access, Not Emails</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                Invite members with a shareable link and a password. No email harvesting, no phone
                number collections, and nothing sold to advertisers.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/80 bg-card/70 rounded-2xl border shadow-xs transition-all hover:border-indigo-500/40 hover:shadow-md">
            <CardHeader className="p-6">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 shadow-2xs dark:text-indigo-400">
                <EyeOff className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold">Zero Tracking, Zero Dark Patterns</CardTitle>
              <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
                No analytics scripts, no cookies, no fingerprinting. If you delete your account,
                everything goes with you — for real.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mb-20 max-w-5xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-tr from-emerald-500/10 via-teal-500/10 to-indigo-500/10 px-6 py-12 text-center backdrop-blur-sm sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-64 w-96 -translate-x-1/2 bg-gradient-to-tr from-emerald-500/25 to-indigo-500/25 blur-[100px]" />
          <h2 className="text-foreground mx-auto max-w-2xl text-3xl leading-tight font-black tracking-tight sm:text-4xl">
            The last expense app your{" "}
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
              group will ever need.
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
            No contacts to upload. No emails to verify. No ads sitting between you and your money —
            just a closed circle, an honest split, and friends who actually chip in.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row">
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-foreground text-background hover:bg-foreground/90 h-12 w-full gap-2 rounded-xl px-7 font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
              >
                Create an Account <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a
              href="https://github.com/aayushsiwa/pacttab"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="lg"
                variant="outline"
                className="border-border/80 hover:bg-muted/60 h-12 w-full gap-2 rounded-xl px-7 font-semibold transition-all active:scale-[0.98] sm:w-auto"
              >
                {githubMark}
                Star on GitHub
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border/60 bg-background/80 w-full border-t backdrop-blur-sm">
        <div className="container mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-sm font-black text-white shadow-sm">
                  ₹
                </div>
                <span className="text-foreground text-base font-extrabold tracking-tight">
                  PactTab
                </span>
              </Link>
              <p className="text-muted-foreground max-w-xs text-xs leading-relaxed">
                Private group expenses and chat. Open source, self-hostable, and free forever.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2 sm:items-end">
              <ul className="flex items-center gap-5">
                <li>
                  <Link
                    href="/signup"
                    className="text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                  >
                    Sign up
                  </Link>
                </li>
                <li>
                  <Link
                    href="/login"
                    className="text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
                  >
                    Sign in
                  </Link>
                </li>
                <li>
                  <a
                    href="https://github.com/aayushsiwa/pacttab"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  >
                    {githubMark}
                    GitHub
                  </a>
                </li>
              </ul>
              <p className="text-muted-foreground mt-2 text-[11px]">
                © {new Date().getFullYear()} PactTab • No cookies. No trackers. Ever.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
