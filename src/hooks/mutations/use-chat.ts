"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
import { useDemoActions } from "@/providers/demo-mode";

export interface SendMessageInput {
  groupId: string;
  body: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const demoActions = useDemoActions();

  return useMutation({
    mutationFn: async (data: SendMessageInput) => {
      if (demoActions) {
        demoActions.sendMessage(data);
        return { success: true };
      }
      const res = await fetch(`/api/groups/${data.groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: data.body }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to send message");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onMutate: async (newMessage) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.messages.list(newMessage.groupId) });
      const previous = queryClient.getQueryData(queryKeys.messages.list(newMessage.groupId)) as
        | unknown[]
        | undefined;

      queryClient.setQueryData(
        queryKeys.messages.list(newMessage.groupId),
        (old: unknown[] | undefined) => [
          ...(old || []),
          {
            id: "temp-" + Date.now(),
            body: newMessage.body,
            type: "user",
            createdAt: new Date().toISOString(),
            optimistic: true,
          },
        ]
      );

      return { previous };
    },
    onError: (err, newMessage, context: { previous?: unknown[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.messages.list(newMessage.groupId), context.previous);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messages.list(variables.groupId) });
    },
  });
}
