"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import type { WSEvent } from "@/lib/ws-hub";

export interface ChatMessage {
  id: string;
  body: string;
  type: string;
  createdAt: string | Date;
  authorId: string | null;
  authorUsername: string | null;
}

interface UseGroupSocketOptions {
  groupId: string;
  userId: string;
  currentUsername?: string;
  onNewMessage?: (msg: ChatMessage) => void;
  /** When false, no WebSocket connection is opened (e.g. static previews). Defaults to true. */
  enabled?: boolean;
}

export function useGroupSocket({
  groupId,
  userId,
  currentUsername,
  onNewMessage,
  enabled = true,
}: UseGroupSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const currentUsernameRef = useRef(currentUsername);
  const queryClient = useQueryClient();

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let isMounted = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    function openSocket() {
      if (!isMounted) return;
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/api/ws?groupId=${encodeURIComponent(groupId)}&userId=${encodeURIComponent(userId)}`;

        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isMounted) setIsConnected(true);
        };

        ws.onclose = () => {
          if (isMounted) {
            setIsConnected(false);
            reconnectTimer = setTimeout(openSocket, 3000);
          }
        };

        ws.onerror = () => {
          if (isMounted) setIsConnected(false);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const data: WSEvent | { type: string } = JSON.parse(event.data);

            if (data.type === "new_message") {
              const msg = (data as Extract<WSEvent, { type: "new_message" }>).message;
              onNewMessageRef.current?.(msg);

              // Optimistically update messages cache
              queryClient.setQueryData(
                queryKeys.messages.list(groupId),
                (old: ChatMessage[] | undefined) => [...(old || []), msg]
              );

              const activeUsername = currentUsernameRef.current;
              if (
                activeUsername &&
                msg.authorId !== userId &&
                msg.body.toLowerCase().includes(`@${activeUsername.toLowerCase()}`)
              ) {
                toast.info(`@${msg.authorUsername || "Someone"} mentioned you: "${msg.body}"`, {
                  duration: 5000,
                });
              }
            } else if (
              data.type === "expense_created" ||
              data.type === "expense_updated" ||
              data.type === "expense_deleted"
            ) {
              const exp = data as Extract<
                WSEvent,
                { type: "expense_created" | "expense_updated" | "expense_deleted" }
              >;
              if (exp.type === "expense_created") {
                toast.info(
                  `${exp.payerUsername} added expense: ${exp.description} (₹${exp.amount.toFixed(2)})`
                );
              } else if (exp.type === "expense_updated") {
                toast.info(`Expense updated: ${exp.description}`);
              } else {
                toast.info(`Expense deleted: ${exp.description}`);
              }
              queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(groupId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(groupId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
            } else if (
              data.type === "settlement_recorded" ||
              data.type === "settlement_confirmed" ||
              data.type === "settlement_rejected" ||
              data.type === "settlement_cancelled"
            ) {
              const set = data as Extract<WSEvent, { type: "settlement_recorded" }>;
              if (data.type === "settlement_recorded") {
                toast.success(
                  `Settlement recorded: ${set.payerUsername} paid ${set.recipientUsername} ₹${set.amount.toFixed(2)}`
                );
              } else if (data.type === "settlement_confirmed") {
                toast.success(`Settlement confirmed`);
              } else if (data.type === "settlement_rejected") {
                toast.error(`Settlement rejected`);
              } else {
                toast.info(`Settlement cancelled`);
              }
              queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
            } else if (data.type === "member_joined") {
              const mem = data as Extract<WSEvent, { type: "member_joined" }>;
              toast.info(`${mem.username} joined the group!`);
              queryClient.invalidateQueries({ queryKey: queryKeys.members.list(groupId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
            } else if (data.type === "join_request_created") {
              const req = data as Extract<WSEvent, { type: "join_request_created" }>;
              toast.info(`@${req.username} requested to join the group`);
              queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.user.pendingAdminActions });
            } else if (data.type === "join_request_reviewed") {
              queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
              queryClient.invalidateQueries({ queryKey: queryKeys.user.pendingAdminActions });
            } else if (data.type === "refresh") {
              queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
            }
          } catch {
            // Ignore parse errors
          }
        };
      } catch {
        if (isMounted) {
          reconnectTimer = setTimeout(openSocket, 3000);
        }
      }
    }

    openSocket();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ action: "ping" }));
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      wsRef.current = null;
    };
  }, [groupId, userId, queryClient, enabled]);

  const sendWsMessage = useCallback(
    (body: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            action: "send_message",
            groupId,
            userId,
            body,
          })
        );
        return true;
      }
      return false;
    },
    [groupId, userId]
  );

  return { isConnected, sendWsMessage };
}
