import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, MessageSquare, Split, ArrowRight, Lock } from "lucide-react";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/groups");
  }

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Hero Section */}
      <section className="w-full py-16 md:py-24 lg:py-28 px-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground mb-6 shadow-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Zero email, zero phone numbers, zero tracking</span>
        </div>

        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground">
          Private group expenses & chat for closed circles.
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          Flatmates, trips, friend groups, and couples. Sign up with only a username and password, share an unguessable invite link, chat, and settle balances in seconds.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md justify-center">
          <Link href="/signup" className="w-full sm:w-auto">
            <Button size="lg" className="w-full gap-2 shadow-sm font-semibold">
              Create an Account <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full">
              Sign In
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          No credit card or personal info required. Completely private.
        </p>
      </section>

      {/* Feature Highlights */}
      <section className="container max-w-5xl px-4 py-8 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border bg-card/60 shadow-xs hover:border-foreground/20 transition-all">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 mb-2">
                <Lock className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">No Personal Data</CardTitle>
              <CardDescription>
                Sign up with just a username and password. No contacts imported, no public user search, and no social graph tracking.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border bg-card/60 shadow-xs hover:border-foreground/20 transition-all">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 mb-2">
                <Split className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Equal Splits & Balances</CardTitle>
              <CardDescription>
                Add shared expenses, split equally among members, and see simplified suggested repayments with exact balance math.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border bg-card/60 shadow-xs hover:border-foreground/20 transition-all">
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 mb-2">
                <MessageSquare className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg">Chat + Activity Stream</CardTitle>
              <CardDescription>
                Keep conversations alongside expense activity in one unified feed. Never switch apps to know who paid for what.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>
    </div>
  );
}
