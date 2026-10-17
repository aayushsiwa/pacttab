import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useExpenses(groupId: string) {
  return useQuery({
    queryKey: queryKeys.expenses.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/expenses`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    enabled: !!groupId,
  });
}
