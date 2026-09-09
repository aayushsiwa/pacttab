"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { signInAction, type AuthActionState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="w-full max-w-md shadow-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold tracking-tight">Sign in</CardTitle>
        <CardDescription>
          Enter your username and password to access your private groups.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        {/* Preserve returnTo target URL */}
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

        <CardContent className="space-y-4">
          {returnTo?.startsWith("/join/") && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-primary">
              <Link2 className="h-4 w-4 shrink-0" />
              <span>You will be redirected back to your group invitation after signing in.</span>
            </div>
          )}

          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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
                className="pl-9"
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="pl-9"
                disabled={isPending}
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign In"}
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup"}
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Create one
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
