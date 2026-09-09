"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/actions/chat";
import { useGroupSocket, type ChatMessage } from "@/hooks/use-group-socket";
import { MessageContent } from "@/components/group/message-content";
import { MentionAutocomplete } from "@/components/group/mention-autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Sparkles, Info, Wifi, WifiOff, AtSign } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  username: string;
}

interface ChatViewProps {
  groupId: string;
  currentUserId: string;
  currentUsername: string;
  members: Member[];
  initialMessages: ChatMessage[];
}

export function ChatView({
  groupId,
  currentUserId,
  currentUsername,
  members,
  initialMessages,
}: ChatViewProps) {
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [isSending, startSending] = useTransition();

  // Mention autocomplete state
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
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
    currentUsername,
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setText(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      setMentionQuery(match[1]);
      setIsMentionOpen(true);
      setMentionIndex(0);
    } else {
      setIsMentionOpen(false);
    }
  };

  const handleSelectMention = (username: string) => {
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursor);
    const textAfterCursor = text.slice(cursor);

    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) return;

    const newTextBefore = textBeforeCursor.slice(0, atIndex) + `@${username} `;
    const newText = newTextBefore + textAfterCursor;

    setText(newText);
    setIsMentionOpen(false);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = newTextBefore.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isMentionOpen) return;

    const filteredMembers = members.filter((m) =>
      m.username.toLowerCase().includes(mentionQuery.toLowerCase())
    );

    if (filteredMembers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((prev) => (prev + 1) % filteredMembers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const selectedMember = filteredMembers[mentionIndex] || filteredMembers[0];
      if (selectedMember) {
        handleSelectMention(selectedMember.username);
      }
    } else if (e.key === "Escape") {
      setIsMentionOpen(false);
    }
  };

  const handleAtButtonClick = () => {
    const cursor = inputRef.current?.selectionStart ?? text.length;
    const newText = text.slice(0, cursor) + "@" + text.slice(cursor);
    setText(newText);
    setMentionQuery("");
    setIsMentionOpen(true);
    setMentionIndex(0);

    setTimeout(() => {
      inputRef.current?.focus();
      const newPos = cursor + 1;
      inputRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSending) return;

    setIsMentionOpen(false);
    const messageText = text.trim();
    setText("");

    // Try sending over WebSocket first for instant delivery
    const sentViaWs = sendWsMessage(messageText);

    if (!sentViaWs) {
      // Fallback to Server Action if socket is disconnected
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
              Chat and financial activity for this group will appear here in real-time over WebSockets. Type @ to mention someone!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSystem = msg.type === "system";
            const isMe = msg.authorId === currentUserId;
            const isMentioned =
              !isMe &&
              !isSystem &&
              msg.body.toLowerCase().includes(`@${currentUsername.toLowerCase()}`);

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
                  <div className="flex items-center gap-1.5 ml-1 mb-1">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      @{msg.authorUsername || "member"}
                    </span>
                    {isMentioned && (
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-1.5 py-0.2 rounded-sm border border-amber-500/30">
                        mentioned you
                      </span>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 text-sm shadow-2xs transition-all ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-xs"
                      : isMentioned
                      ? "bg-amber-500/5 text-foreground border-2 border-amber-500/50 shadow-sm rounded-bl-xs"
                      : "bg-muted text-foreground border rounded-bl-xs"
                  }`}
                >
                  <MessageContent
                    body={msg.body}
                    currentUsername={currentUsername}
                    isMe={isMe}
                  />
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

      {/* Message Input with Mention Autocomplete */}
      <div className="relative p-3 border-t bg-background/80">
        {isMentionOpen && (
          <MentionAutocomplete
            members={members}
            query={mentionQuery}
            selectedIndex={mentionIndex}
            onSelect={handleSelectMention}
            currentUserId={currentUserId}
          />
        )}

        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAtButtonClick}
            title="Mention a member (@)"
            className="shrink-0 text-muted-foreground hover:text-foreground h-9 w-9"
          >
            <AtSign className="h-4 w-4" />
          </Button>

          <Input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or @mention someone..."
            className="flex-1 bg-card"
            maxLength={1000}
            disabled={isSending}
          />

          <Button type="submit" size="icon" disabled={!text.trim() || isSending} className="shrink-0 h-9 w-9">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
