import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups.lists(),
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });
}

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: queryKeys.groups.detail(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: !!groupId,
  });
}
