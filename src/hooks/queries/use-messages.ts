import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useMessages(groupId: string) {
  return useQuery({
    queryKey: queryKeys.messages.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!groupId,
  });
}
