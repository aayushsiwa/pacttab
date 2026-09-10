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
import { Send, Sparkles, Info, Wifi, WifiOff, AtSign, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, formatTime } from "@/lib/date";
import { UserAvatar } from "@/components/ui/user-avatar";

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
  onUnreadChange?: (count: number) => void;
}

export function ChatView({
  groupId,
  currentUserId,
  currentUsername,
  members,
  initialMessages,
  onUnreadChange,
}: ChatViewProps) {
  const [realtimeMessages, setRealtimeMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [isSending, startSending] = useTransition();

  // Unread messages tracking
  const [lastReadTimestamp, setLastReadTimestamp] = useState<number | null>(null);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const onUnreadChangeRef = useRef(onUnreadChange);

  useEffect(() => {
    onUnreadChangeRef.current = onUnreadChange;
  }, [onUnreadChange]);

  // Load last read timestamp from localStorage
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      const stored =
        localStorage.getItem(`pacttab_read_${groupId}_${currentUserId}`) ||
        localStorage.getItem(`splitgroup_read_${groupId}_${currentUserId}`);
      const val = stored ? Number(stored) : Date.now() - 1000 * 60 * 60;
      timerId = setTimeout(() => {
        setLastReadTimestamp(val);
      }, 0);
    } catch {
      timerId = setTimeout(() => {
        setLastReadTimestamp(Date.now());
      }, 0);
    }
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [groupId, currentUserId]);

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

  const markAllAsRead = useCallback(() => {
    const now = Date.now();
    setLastReadTimestamp(now);
    setHasMarkedRead(true);
    onUnreadChangeRef.current?.(0);
    try {
      localStorage.setItem(`pacttab_read_${groupId}_${currentUserId}`, String(now));
      localStorage.setItem(`splitgroup_read_${groupId}_${currentUserId}`, String(now));
    } catch {}
  }, [groupId, currentUserId]);

  const isMsgUnread = useCallback(
    (msg: ChatMessage) => {
      if (hasMarkedRead) return false;
      if (!lastReadTimestamp) return false;
      if (msg.authorId === currentUserId) return false;
      return new Date(msg.createdAt).getTime() > lastReadTimestamp;
    },
    [hasMarkedRead, lastReadTimestamp, currentUserId]
  );

  const unreadCount = hasMarkedRead ? 0 : messages.filter(isMsgUnread).length;
  const firstUnreadIndex = hasMarkedRead ? -1 : messages.findIndex(isMsgUnread);

  useEffect(() => {
    onUnreadChangeRef.current?.(unreadCount);
  }, [unreadCount]);

  // Automatically mark as read after 4 seconds of viewing the active chat
  useEffect(() => {
    if (!lastReadTimestamp || unreadCount === 0) return;
    const timer = setTimeout(() => {
      markAllAsRead();
    }, 4000);
    return () => clearTimeout(timer);
  }, [lastReadTimestamp, unreadCount, markAllAsRead]);

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
    <div className="border-border/80 bg-card/60 flex h-[calc(100dvh-17.5rem)] max-h-[700px] min-h-[460px] flex-col overflow-hidden rounded-2xl border shadow-xs sm:h-[620px]">
      {/* Real-time Status Header */}
      <div className="border-border/70 bg-muted/30 text-muted-foreground flex items-center justify-between border-b px-3.5 py-2.5 text-xs sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <span className="text-foreground text-xs font-bold sm:text-sm">Room Chat & Feed</span>
          <span className="text-muted-foreground hidden text-[11px] sm:inline-block">
            • Real-time updates
          </span>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
              title="Click to mark all as read"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <span>{unreadCount} new • Mark read</span>
            </button>
          )}

          {isConnected ? (
            <Badge
              variant="outline"
              className="gap-1.5 rounded-full border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Live Synced</span>
              <span className="sm:hidden">Live</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="text-muted-foreground gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
            >
              <WifiOff className="h-3 w-3" />
              <span>Connecting...</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        {messages.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-6 text-center sm:p-8">
            <Info className="mb-2 h-8 w-8 opacity-40" />
            <p className="text-sm font-medium">No messages yet</p>
            <p className="mt-1 max-w-xs text-xs opacity-75">
              Chat and financial activity for this group will appear here in real-time over
              WebSockets. Type @ to mention someone!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isSystem = msg.type === "system";
            const isMe = msg.authorId === currentUserId;
            const isMentioned =
              !isMe &&
              !isSystem &&
              msg.body.toLowerCase().includes(`@${currentUsername.toLowerCase()}`);
            const isUnread = isMsgUnread(msg);

            return (
              <div key={msg.id} className="space-y-3">
                {/* Unread Divider above the first unread message */}
                {idx === firstUnreadIndex && (
                  <div className="my-3 flex items-center gap-3">
                    <div className="flex-1 border-t border-emerald-500/30" />
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      <span>New • Not read yet</span>
                    </div>
                    <div className="flex-1 border-t border-emerald-500/30" />
                  </div>
                )}

                {isSystem ? (
                  <div className="my-2 flex justify-center">
                    <div className="border-border/80 bg-muted/70 text-muted-foreground inline-flex max-w-[90%] items-center gap-1.5 rounded-full border px-3 py-1 text-center text-[11px] font-medium shadow-2xs">
                      <Sparkles className="text-primary h-3 w-3 shrink-0" />
                      <span className="truncate">{msg.body}</span>
                      <span
                        className="shrink-0 text-[10px] opacity-60"
                        title={formatTime(msg.createdAt)}
                      >
                        • {formatRelativeTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    {!isMe && (
                      <div className="mb-1 ml-1 flex items-center gap-1.5">
                        <UserAvatar username={msg.authorUsername || "member"} size="xs" />
                        <span className="text-muted-foreground text-[11px] font-bold">
                          @{msg.authorUsername || "member"}
                        </span>
                        {isUnread && (
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-500 shadow-2xs"
                              title="Not read yet"
                            />
                            <span className="py-0.1 rounded-xs border border-emerald-500/20 bg-emerald-500/10 px-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              NEW
                            </span>
                          </span>
                        )}
                        {isMentioned && (
                          <span className="py-0.2 rounded-sm border border-amber-500/30 bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                            mentioned you
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm shadow-2xs transition-all sm:max-w-[70%] ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-xs"
                          : isMentioned
                            ? "text-foreground rounded-bl-xs border-2 border-amber-500/50 bg-amber-500/5 shadow-sm"
                            : isUnread
                              ? "bg-card text-foreground rounded-bl-xs border-2 border-emerald-500/40 shadow-xs"
                              : "bg-muted text-foreground border-border/80 rounded-bl-xs border"
                      }`}
                    >
                      <MessageContent
                        body={msg.body}
                        currentUsername={currentUsername}
                        isMe={isMe}
                      />
                      <div
                        className={`mt-1 flex items-center justify-end gap-1 text-right text-[10px] ${
                          isMe ? "text-primary-foreground/75" : "text-muted-foreground"
                        }`}
                      >
                        <span title={formatTime(msg.createdAt)}>
                          {formatRelativeTime(msg.createdAt)}
                        </span>
                        {isMe && <CheckCheck className="inline h-3 w-3 opacity-70" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input with Mention Autocomplete */}
      <div className="border-border/80 bg-background/80 relative border-t p-2.5 sm:p-3">
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
            className="text-muted-foreground hover:text-foreground h-10 w-10 shrink-0 rounded-xl sm:h-9 sm:w-9"
          >
            <AtSign className="h-4 w-4" />
          </Button>

          <Input
            ref={inputRef}
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or @mention someone..."
            className="bg-card h-10 flex-1 rounded-xl text-sm"
            maxLength={1000}
            disabled={isSending}
          />

          <Button
            type="submit"
            size="icon"
            disabled={!text.trim() || isSending}
            className="h-10 w-10 shrink-0 rounded-xl font-bold shadow-xs sm:h-9 sm:w-9"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
