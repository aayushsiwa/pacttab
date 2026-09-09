"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight } from "lucide-react";

export interface GroupCardItem {
  id: string;
  name: string;
  description: string | null;
  role: string;
  joinedAt: Date | string;
  createdAt: Date | string;
  memberCount: number;
  lastIncomingMessageAt: Date | string | null;
}

interface GroupCardProps {
  group: GroupCardItem;
  currentUserId: string;
  gradient: string;
}

export function GroupCard({ group, currentUserId, gradient }: GroupCardProps) {
  const [isUnread, setIsUnread] = useState(false);

  useEffect(() => {
    const checkUnread = () => {
      if (!group.lastIncomingMessageAt) {
        setIsUnread(false);
        return;
      }

      try {
        const stored = localStorage.getItem(`splitgroup_read_${group.id}_${currentUserId}`);
        const incomingTime = new Date(group.lastIncomingMessageAt).getTime();

        if (stored) {
          setIsUnread(incomingTime > Number(stored));
        } else {
          // If the user has never opened this group on this browser, consider messages unread
          setIsUnread(true);
        }
      } catch {
        setIsUnread(false);
      }
    };

    checkUnread();

    window.addEventListener("focus", checkUnread);
    window.addEventListener("storage", checkUnread);
    return () => {
      window.removeEventListener("focus", checkUnread);
      window.removeEventListener("storage", checkUnread);
    };
  }, [group.id, group.lastIncomingMessageAt, currentUserId]);

  return (
    <Link href={`/group/${group.id}`} className="group block">
      <Card
        className={`h-full border transition-all duration-200 hover:border-emerald-500/40 hover:shadow-md hover:-translate-y-0.5 rounded-2xl overflow-hidden flex flex-col justify-between ${
          isUnread
            ? "border-emerald-500/40 bg-card shadow-2xs ring-1 ring-emerald-500/20"
            : "border-border/80 bg-card/80"
        }`}
      >
        <CardHeader className="p-5 pb-3">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 min-w-0">
              {/* Avatar with unread notification dot */}
              <div className="relative shrink-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${gradient} text-white font-bold text-sm shadow-2xs`}
                >
                  {group.name.charAt(0).toUpperCase()}
                </div>

                {isUnread && (
                  <span
                    className="absolute -top-1 -right-1 flex h-3.5 w-3.5"
                    title="Unread messages in group"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 ring-2 ring-card shadow-xs" />
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-base font-bold group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                    {group.name}
                  </CardTitle>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Created group
                </span>
              </div>
            </div>

            {/* Badges: Unread notification pill + Admin/Member badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isUnread && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5 shadow-2xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>NEW</span>
                </span>
              )}

              <Badge
                variant={group.role === "admin" ? "default" : "secondary"}
                className={`text-[10px] uppercase font-bold tracking-wider shrink-0 rounded-full px-2 py-0.5 ${
                  group.role === "admin"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {group.role}
              </Badge>
            </div>
          </div>

          {group.description && (
            <CardDescription className="line-clamp-2 text-xs mt-1 text-muted-foreground leading-relaxed">
              {group.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardFooter className="px-5 py-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 bg-muted/20">
          <div className="flex items-center gap-1.5 font-medium">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span>
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
            </span>
          </div>

          {isUnread ? (
            <span className="flex items-center gap-1.5 font-bold text-xs text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-all">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              <span>Unread messages</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          ) : (
            <span className="flex items-center gap-1 font-bold text-xs text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all">
              Open Room <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
