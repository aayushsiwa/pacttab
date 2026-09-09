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
  const filtered = members.filter((m) =>
    m.username.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (listRef.current) {
      const activeItem = listRef.current.children[selectedIndex] as HTMLElement | undefined;
      activeItem?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (filtered.length === 0) {
    return (
      <div className="absolute bottom-full left-2 right-2 sm:right-auto sm:left-3 mb-2 w-auto sm:w-64 max-w-sm rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-2.5 text-xs text-muted-foreground shadow-lg z-30">
        No matching members found
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-2 right-2 sm:right-auto sm:left-3 mb-2 w-auto sm:w-72 max-w-sm max-h-48 overflow-y-auto rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1.5 shadow-xl z-30 divide-y divide-border/40"
    >
      <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        <AtSign className="h-3 w-3 text-primary" />
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
              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left ${
                isSelected
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-muted text-popover-foreground"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <UserAvatar username={member.username} size="xs" />
                <span className="truncate">@{member.username}</span>
              </div>
              {isMe && (
                <span className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
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
