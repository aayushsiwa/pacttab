"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { AlertCircle, ShieldAlert, Lock, User, Link2, Check } from "lucide-react";
import { SocialSignInOptions } from "@/components/auth/social-sign-in-options";
import type { SocialAuthProvider } from "@/lib/social-auth-config";
import { safeReturnTo } from "@/lib/safe-return-to";

interface SignUpFormProps {
  providers: { id: SocialAuthProvider; label: string }[];
  returnTo?: string;
}

export function SignUpForm({ providers, returnTo }: SignUpFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const effectiveReturnTo = safeReturnTo(returnTo || searchParams?.get("returnTo"));

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please ensure both passwords match.");
      return;
    }
    setIsPending(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, confirmPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(effectiveReturnTo);
        router.refresh();
      } else {
        setError(data.error);
        if (data.username) setUsername(data.username);
      }
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Card className="border-border/80 bg-card/90 w-full max-w-md overflow-hidden rounded-2xl shadow-xl backdrop-blur-sm">
      <CardHeader className="p-6 pb-4 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-xl font-black text-white shadow-sm">
          ₹
        </div>
        <CardTitle className="text-foreground text-2xl font-black tracking-tight">
          Create your account
        </CardTitle>
        <CardDescription className="text-muted-foreground mt-1 text-xs leading-relaxed sm:text-sm">
          Join with only a username and password. Zero email or phone needed.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 px-6">
          {effectiveReturnTo.startsWith("/join/") && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <Link2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                You will automatically proceed to your group invitation after creating your account.
              </span>
            </div>
          )}

          {/* MVP Warning notice */}
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="leading-relaxed">
              <strong className="font-bold">Privacy Note:</strong> Without emails or phone numbers,{" "}
              <span className="font-semibold underline">passwords cannot be reset</span>. Please
              keep your credentials safe.
            </div>
          </div>

          {error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2.5 rounded-xl border p-3 text-xs font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
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
            <p className="text-muted-foreground text-[11px]">
              3–30 characters: letters, numbers, and underscores only.
            </p>
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="h-10 rounded-xl pl-10"
                disabled={isPending}
              />
            </div>
            <p className="text-muted-foreground text-[11px]">Minimum 6 characters.</p>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-muted-foreground text-xs font-bold tracking-wider uppercase"
            >
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="text-muted-foreground absolute top-3 left-3.5 h-4 w-4" />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="••••••••"
                autoComplete="new-password"
                required
                className="h-10 rounded-xl pl-10"
                disabled={isPending}
              />
            </div>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <p className="text-destructive text-[11px] font-medium">Passwords do not match.</p>
            )}
            {confirmPassword.length > 0 && password.length >= 6 && password === confirmPassword && (
              <p className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" /> Passwords match.
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="mt-4 flex flex-col gap-3.5 p-6">
          <Button
            type="submit"
            className="h-11 w-full rounded-xl font-bold shadow-sm"
            disabled={isPending}
          >
            {isPending ? "Creating account..." : "Create Account"}
          </Button>

          <SocialSignInOptions providers={providers} returnTo={effectiveReturnTo} />

          <div className="text-muted-foreground text-center text-xs font-medium">
            Already have an account?{" "}
            <Link
              href={
                effectiveReturnTo
                  ? `/login?returnTo=${encodeURIComponent(effectiveReturnTo)}`
                  : "/login"
              }
              className="text-foreground hover:text-primary font-bold underline underline-offset-4 transition-colors"
            >
              Sign in
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
