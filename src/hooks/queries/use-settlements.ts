import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useSettlements(groupId: string) {
  return useQuery({
    queryKey: queryKeys.settlements.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/settlements`);
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return res.json();
    },
    enabled: !!groupId,
  });
}
