"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/actions/chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, User, Info } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  body: string;
  type: string;
  createdAt: Date;
  authorId: string | null;
  authorUsername: string | null;
}

interface ChatViewProps {
  groupId: string;
  currentUserId: string;
  initialMessages: Message[];
}

export function ChatView({ groupId, currentUserId, initialMessages }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [isSending, startSending] = useTransition();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Keep state in sync with server revalidations
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Scroll to bottom on updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling for live chat and activity updates
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [router]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    const messageText = text.trim();
    setText("");

    startSending(async () => {
      const res = await sendMessageAction(groupId, messageText);
      if (!res.success) {
        toast.error(res.error || "Failed to send message");
        setText(messageText); // Restore on error
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col h-[600px] rounded-xl border bg-card/40 shadow-xs overflow-hidden">
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground p-8">
            <Info className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs max-w-xs mt-1 opacity-75">
              Chat and financial activity for this group will appear here in chronological order.
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
          placeholder="Send a message to group..."
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
