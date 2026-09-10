"use client";

import { useEffect, useRef } from "react";
import { AtSign } from "lucide-react";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Member {
  id: string;
  username: string;
}

interface MentionAutocompleteProps {
  members: Member[];
  query: string;
  selectedIndex: number;
  onSelect: (username: string) => void;
  currentUserId: string;
}

export function MentionAutocomplete({
  members,
  query,
  selectedIndex,
  onSelect,
  currentUserId,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Filter members matching query (case-insensitive)
  const filtered = members.filter((m) => m.username.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (listRef.current) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      activeItem?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="border-border/80 bg-popover/95 text-muted-foreground absolute right-2 bottom-full left-2 z-30 mb-2 w-auto max-w-sm rounded-xl border p-2.5 text-xs shadow-lg backdrop-blur-md sm:right-auto sm:left-3 sm:w-64">
        No matching members found
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="border-border/80 bg-popover/95 divide-border/40 absolute right-2 bottom-full left-2 z-30 mb-2 max-h-48 w-auto max-w-sm divide-y overflow-y-auto rounded-xl border p-1.5 shadow-xl backdrop-blur-md sm:right-auto sm:left-3 sm:w-72"
    >
      <div className="text-muted-foreground flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase">
        <AtSign className="text-primary h-3 w-3" />
        <span>Mention member</span>
      </div>
      <div className="space-y-0.5 pt-1">
        {filtered.map((member, idx) => {
          const isSelected = idx === selectedIndex;
          const isMe = member.id === currentUserId;

          return (
            <button
              key={member.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                onSelect(member.username);
              }}
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-popover-foreground"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <UserAvatar username={member.username} size="xs" />
                <span className="truncate">@{member.username}</span>
              </div>
              {isMe && (
                <span
                  className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                >
                  (you)
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
