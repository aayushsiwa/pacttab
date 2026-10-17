import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useMembers(groupId: string) {
  return useQuery({
    queryKey: queryKeys.members.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/members`);
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!groupId,
  });
}
