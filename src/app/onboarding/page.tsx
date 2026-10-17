"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function OnboardingPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Please enter a username");
      return;
    }

    if (trimmed.length < 3 || trimmed.length > 30) {
      setError("Username must be 3–30 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    setIsPending(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed.toLowerCase() }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/groups");
        router.refresh();
      } else {
        setError(
          data.error === "username-taken"
            ? "Username is already taken."
            : data.error || "Failed to complete onboarding"
        );
      }
    } catch {
      setError("Failed to complete onboarding. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-card w-full space-y-4 rounded-2xl border p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-black">Choose your PactTab handle</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            This is what your groups will see. Your provider email stays private.
          </p>
        </div>
        {error && <div className="text-destructive text-sm">{error}</div>}
        <Input
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          autoComplete="username"
          placeholder="e.g. arjun_99"
          disabled={isPending}
        />
        <Button className="w-full" type="submit" disabled={isPending}>
          {isPending ? "Continuing..." : "Continue"}
        </Button>
      </form>
    </main>
  );
}
