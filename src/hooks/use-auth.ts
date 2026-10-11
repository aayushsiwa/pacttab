"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useAuth(requireAuth = true) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && requireAuth && !session) {
      router.push("/login");
    }
  }, [session, isPending, requireAuth, router]);

  return {
    user: session?.user ?? null,
    isLoading: isPending,
    isAuthenticated: !!session,
  };
}
