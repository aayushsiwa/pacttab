"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Home, Users } from "lucide-react";

const REDIRECT_SECONDS = 10;

export default function NotFound() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      router.replace("/");
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, router]);

  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-primary font-mono text-7xl font-extrabold tracking-tight sm:text-8xl">
        404
      </p>
      <h1 className="text-foreground mt-3 text-xl font-bold sm:text-2xl">Page not found</h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist, was moved, or the link is broken.
      </p>

      <div className="mt-8 w-full max-w-xs space-y-2">
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${(secondsLeft / REDIRECT_SECONDS) * 100}%` }}
          />
        </div>
        <p className="text-muted-foreground text-xs font-medium">
          Redirecting to home in{" "}
          <span className="text-foreground font-bold tabular-nums">
            {Math.max(secondsLeft, 0)}s
          </span>
          …
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/">
          <Button size="lg" className="h-11 gap-2 px-6 font-semibold">
            <Home />
            Go home
          </Button>
        </Link>
        <Link href="/groups">
          <Button size="lg" variant="outline" className="h-11 gap-2 px-6 font-semibold">
            <Users />
            Go to groups
          </Button>
        </Link>
      </div>
    </div>
  );
}
