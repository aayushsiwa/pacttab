import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useUserPendingJoinRequests() {
  return useQuery({
    queryKey: queryKeys.user.pendingJoinRequests,
    queryFn: async () => {
      const res = await fetch("/api/user/join-requests");
      if (!res.ok) throw new Error("Failed to fetch pending join requests");
      return res.json();
    },
  });
}

export function useUserPendingAdminActions() {
  return useQuery({
    queryKey: queryKeys.user.pendingAdminActions,
    queryFn: async () => {
      const res = await fetch("/api/user/admin-actions-count");
      if (!res.ok) throw new Error("Failed to fetch pending admin actions count");
      return res.json();
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ["user", "me"] as const,
    queryFn: async () => {
      const res = await fetch("/api/user/me");
      if (!res.ok) throw new Error("Failed to fetch current user");
      return res.json() as Promise<{
        id: string;
        username: string;
        createdAt: string;
        needsUsername: boolean;
      }>;
    },
  });
}
