import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useGroups<TData = unknown>() {
  return useQuery<TData>({
    queryKey: queryKeys.groups.lists(),
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });
}

export function useGroupDetail<TData = unknown>(groupId: string) {
  return useQuery<TData>({
    queryKey: queryKeys.groups.detail(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useUserPendingJoinRequests<TData = unknown>() {
  return useQuery<TData>({
    queryKey: queryKeys.user.pendingJoinRequests,
    queryFn: async () => {
      const res = await fetch("/api/user/join-requests");
      if (!res.ok) throw new Error("Failed to fetch pending join requests");
      return res.json();
    },
  });
}

export function useUserPendingAdminActionsCount<TData = unknown>() {
  return useQuery<TData>({
    queryKey: queryKeys.user.pendingAdminActions,
    queryFn: async () => {
      const res = await fetch("/api/user/admin-actions-count");
      if (!res.ok) throw new Error("Failed to fetch admin actions count");
      return res.json();
    },
  });
}

export function useMessages<TData = unknown>(groupId: string) {
  return useQuery<TData>({
    queryKey: queryKeys.messages.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useExpenses<TData = unknown>(groupId: string) {
  return useQuery<TData>({
    queryKey: queryKeys.expenses.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/expenses`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useSettlements<TData = unknown>(groupId: string) {
  return useQuery<TData>({
    queryKey: queryKeys.settlements.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/settlements`);
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useBalances<TData = unknown>(groupId: string) {
  return useQuery<TData>({
    queryKey: queryKeys.balances.detail(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/balances`);
      if (!res.ok) throw new Error("Failed to fetch balances");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useMembers<TData = unknown>(groupId: string) {
  return useQuery<TData>({
    queryKey: queryKeys.members.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!groupId,
  });
}
