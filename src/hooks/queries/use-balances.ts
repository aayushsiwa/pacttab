import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useBalances(groupId: string) {
  return useQuery({
    queryKey: queryKeys.balances.detail(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/balances`);
      if (!res.ok) throw new Error("Failed to fetch balances");
      return res.json();
    },
    enabled: !!groupId,
  });
}
