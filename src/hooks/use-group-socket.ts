"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
}

export function useGroupSocket({
  groupId,
  userId,
  currentUsername,
  onNewMessage,
}: UseGroupSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const currentUsernameRef = useRef(currentUsername);
  const router = useRouter();

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  useEffect(() => {
    if (typeof window === "undefined") return;

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
            } else if (data.type === "expense_created") {
              const exp = data as Extract<WSEvent, { type: "expense_created" }>;
              toast.info(
                `${exp.payerUsername} added expense: ${exp.description} (₹${exp.amount.toFixed(2)})`
              );
              router.refresh();
            } else if (data.type === "expense_deleted") {
              const exp = data as Extract<WSEvent, { type: "expense_deleted" }>;
              toast.info(`Expense deleted: ${exp.description}`);
              router.refresh();
            } else if (data.type === "settlement_recorded") {
              const set = data as Extract<WSEvent, { type: "settlement_recorded" }>;
              toast.success(
                `Settlement recorded: ${set.payerUsername} paid ${set.recipientUsername} ₹${set.amount.toFixed(2)}`
              );
              router.refresh();
            } else if (data.type === "member_joined") {
              const mem = data as Extract<WSEvent, { type: "member_joined" }>;
              toast.info(`${mem.username} joined the group!`);
              router.refresh();
            } else if (data.type === "join_request_created") {
              const req = data as Extract<WSEvent, { type: "join_request_created" }>;
              toast.info(`@${req.username} requested to join the group`);
              router.refresh();
            } else if (data.type === "join_request_reviewed") {
              router.refresh();
            } else if (data.type === "refresh") {
              router.refresh();
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
  }, [groupId, userId, onNewMessage, router]);

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
