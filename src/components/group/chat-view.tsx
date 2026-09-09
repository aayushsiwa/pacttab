"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/actions/chat";
import { useGroupSocket, type ChatMessage } from "@/hooks/use-group-socket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Info, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

interface ChatViewProps {
  groupId: string;
  currentUserId: string;
  initialMessages: ChatMessage[];
}

export function ChatView({ groupId, currentUserId, initialMessages }: ChatViewProps) {
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [isSending, startSending] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Handle incoming real-time WebSocket messages
  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setRealtimeMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const { isConnected, sendWsMessage } = useGroupSocket({
    groupId,
    userId: currentUserId,
    onNewMessage: handleNewMessage,
  });

  // Combine initialMessages with realtimeMessages, deduplicated by ID
  const messageMap = new Map<string, ChatMessage>();
  for (const m of initialMessages) messageMap.set(m.id, m);
  for (const m of realtimeMessages) messageMap.set(m.id, m);
  const messages = Array.from(messageMap.values());

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Fallback background sync (every 15s) in case socket reconnects
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected) {
        router.refresh();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, router]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    const messageText = text.trim();
    setText("");

    // Try sending over WebSocket first for instant delivery
    const sentViaWs = sendWsMessage(messageText);

    if (!sentViaWs) {
      // Fallback to Server Action if socket is buffering / disconnected
      startSending(async () => {
        const res = await sendMessageAction(groupId, messageText);
        if (!res.success) {
          toast.error(res.error || "Failed to send message");
          setText(messageText);
        } else {
          router.refresh();
        }
      });
    }
  };

  return (
    <div className="flex flex-col h-[600px] rounded-xl border bg-card/40 shadow-xs overflow-hidden">
      {/* Real-time Status Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
        <span className="font-medium">Group Discussion & Activity Feed</span>
        <div className="flex items-center gap-1.5">
          {isConnected ? (
            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <Wifi className="h-3 w-3" />
              <span>WebSocket Live</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              <span>Connecting...</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
            <Info className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs max-w-xs mt-1 opacity-75">
              Chat and financial activity for this group will appear here in real-time over WebSockets.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.type === "system";
            const isMe = msg.authorId === currentUserId;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border bg-muted/70 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-2xs">
                    <Sparkles className="h-3 w-3 text-primary shrink-0" />
                    <span>{msg.body}</span>
                    <span className="text-[10px] opacity-60">
                      • {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {!isMe && (
                  <span className="text-[11px] font-semibold text-muted-foreground ml-1 mb-1 flex items-center gap-1">
                    @{msg.authorUsername || "member"}
                  </span>
                )}
                <div
                  className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-2xs ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : "bg-muted text-foreground border rounded-bl-xs"
                  }`}
                >
                  <p className="break-words whitespace-pre-wrap">{msg.body}</p>
                  <div
                    className={`text-[10px] mt-1 text-right ${
                      isMe ? "text-primary-foreground/75" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form onSubmit={handleSend} className="p-3 border-t bg-background/80 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a real-time message..."
          className="flex-1 bg-card"
          maxLength={1000}
          disabled={isSending}
        />
        <Button type="submit" size="icon" disabled={!text.trim() || isSending} className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
