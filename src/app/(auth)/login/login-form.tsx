"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Lock, User, Link2 } from "lucide-react";

interface LoginFormProps {
  returnTo?: string;
}

export function LoginForm({ returnTo }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState<AuthActionState | null, FormData>(
    signInAction,
    null
  );

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Card className="border-border/80 bg-card/90 w-full max-w-md overflow-hidden rounded-2xl shadow-xl backdrop-blur-sm">
      <CardHeader className="p-6 pb-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-xl font-black text-white shadow-sm">
          ₹
        </div>
        <CardTitle className="text-foreground text-2xl font-black tracking-tight">
          Welcome back
        </CardTitle>
        <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
          Enter your handle and password to access your private groups.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        {/* Preserve returnTo target URL */}
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <CardContent className="space-y-4 px-6">
          {returnTo?.startsWith("/join/") && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <Link2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>You will be redirected back to your group invitation after signing in.</span>
            </div>
          )}

          {state?.error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
            >
              Username
            </Label>
            <div className="relative">
              <User className="text-muted-foreground absolute top-3 left-3.5 h-4 w-4" />
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
                className="h-10 rounded-xl pl-10"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
            >
              Password
            </Label>
            <div className="relative">
              <Lock className="text-muted-foreground absolute top-3 left-3.5 h-4 w-4" />
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="h-10 rounded-xl pl-10"
                disabled={isPending}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3.5 p-6 pt-2">
          <Button
            type="submit"
            className="h-11 w-full rounded-xl font-bold shadow-sm"
            disabled={isPending}
          >
            {isPending ? "Signing in..." : "Sign In"}
          </Button>

          <div className="text-muted-foreground text-center text-xs font-medium">
            Don&apos;t have an account?{" "}
            <Link
              href={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"}
              className="text-foreground hover:text-primary font-bold underline underline-offset-4 transition-colors"
            >
              Create one
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
