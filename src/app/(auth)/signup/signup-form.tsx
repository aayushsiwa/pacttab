"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, ShieldAlert, Lock, User, Link2 } from "lucide-react";

interface SignUpFormProps {
  returnTo?: string;
}

export function SignUpForm({ returnTo }: SignUpFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionState | null, FormData>(
    signUpAction,
    null
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="w-full max-w-md border-border/80 bg-card/90 shadow-xl backdrop-blur-sm rounded-2xl overflow-hidden">
      <CardHeader className="p-6 pb-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white font-black text-xl shadow-sm mb-3">
          ₹
        </div>
        <CardTitle className="text-2xl font-black tracking-tight text-foreground">Create your account</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">
          Join with only a username and password. Zero email or phone needed.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        {/* Preserve returnTo target URL */}
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <CardContent className="space-y-4 px-6">
          {returnTo?.startsWith("/join/") && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              <Link2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>You will automatically proceed to your group invitation after creating your account.</span>
            </div>
          )}

          {/* MVP Warning notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-bold">Privacy Note:</strong> Without emails or phone numbers, <span className="underline font-semibold">passwords cannot be reset</span>. Please keep your credentials safe.
            </div>
          </div>

          {state?.error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Username
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. arjun_99"
                autoCapitalize="none"
                autoComplete="username"
                required
                className="pl-10 h-10 rounded-xl"
                disabled={isPending}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              3–30 characters: letters, numbers, and underscores only.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="pl-10 h-10 rounded-xl"
                disabled={isPending}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Minimum 6 characters.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3.5 p-6 pt-2">
          <Button type="submit" className="w-full h-11 rounded-xl font-bold shadow-sm" disabled={isPending}>
            {isPending ? "Creating account..." : "Create Account"}
          </Button>

          <div className="text-center text-xs text-muted-foreground font-medium">
            Already have an account?{" "}
            <Link
              href={returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login"}
              className="font-bold text-foreground underline underline-offset-4 hover:text-primary transition-colors"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
