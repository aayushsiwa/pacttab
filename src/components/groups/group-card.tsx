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
  pendingJoinRequestsCount?: number;
  pendingSettlementsCount?: number;
  pendingActionCount?: number;
}

interface GroupCardProps {
  group: GroupCardItem;
  currentUserId: string;
  gradient: string;
}

export function GroupCard({ group, currentUserId, gradient }: GroupCardProps) {
  const [isUnread, setIsUnread] = useState(false);
  const hasJoinRequests = group.role === "admin" && (group.pendingJoinRequestsCount ?? 0) > 0;
  const hasPendingAction = (group.pendingActionCount ?? 0) > 0 || hasJoinRequests;

  useEffect(() => {
    const checkUnread = () => {
      if (!group.lastIncomingMessageAt) {
        setIsUnread(false);
        return;
      }

      try {
        const stored =
          localStorage.getItem(`pacttab_read_${group.id}_${currentUserId}`) ||
          localStorage.getItem(`splitgroup_read_${group.id}_${currentUserId}`);
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
        className={`flex h-full flex-col justify-between overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md ${
          hasPendingAction
            ? "bg-card border-amber-500/40 shadow-2xs ring-1 ring-amber-500/20"
            : isUnread
              ? "bg-card border-emerald-500/40 shadow-2xs ring-1 ring-emerald-500/20"
              : "border-border/80 bg-card/80"
        }`}
      >
        <CardHeader className="p-5 pb-3">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {/* Avatar with unread / pending action notification dot */}
              <div className="relative shrink-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${gradient} text-sm font-bold text-white shadow-2xs`}
                >
                  {group.name.charAt(0).toUpperCase()}
                </div>

                {hasPendingAction ? (
                  <span
                    className="absolute -top-1 -right-1 flex h-3.5 w-3.5"
                    title={
                      hasJoinRequests
                        ? `${group.pendingJoinRequestsCount} join request(s) awaiting admin approval`
                        : "Action awaiting confirmation"
                    }
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="ring-card relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-500 shadow-xs ring-2" />
                  </span>
                ) : isUnread ? (
                  <span
                    className="absolute -top-1 -right-1 flex h-3.5 w-3.5"
                    title="Unread messages in group"
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="ring-card relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 shadow-xs ring-2" />
                  </span>
                ) : null}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <CardTitle className="truncate text-base font-bold transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {group.name}
                  </CardTitle>
                </div>
                <span className="text-muted-foreground text-[11px]">Created group</span>
              </div>
            </div>

            {/* Badges: Action Required / Unread notification pill + Admin/Member badge */}
            <div className="flex shrink-0 items-center gap-1.5">
              {hasPendingAction && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-700 shadow-2xs dark:text-amber-300"
                  title={
                    hasJoinRequests
                      ? `${group.pendingJoinRequestsCount} join request(s) awaiting approval`
                      : "Action required"
                  }
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  <span>
                    {hasJoinRequests
                      ? `${group.pendingJoinRequestsCount} REQUEST${(group.pendingJoinRequestsCount || 0) > 1 ? "S" : ""}`
                      : "ACTION"}
                  </span>
                </span>
              )}

              {isUnread && !hasPendingAction && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 shadow-2xs dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  <span>NEW</span>
                </span>
              )}

              <Badge
                variant={group.role === "admin" ? "default" : "secondary"}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                  group.role === "admin"
                    ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {group.role}
              </Badge>
            </div>
          </div>

          {group.description && (
            <CardDescription className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
              {group.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardFooter className="text-muted-foreground border-border/60 bg-muted/20 flex items-center justify-between border-t px-5 py-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <Users className="text-muted-foreground h-3.5 w-3.5" />
            <span>
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"}
            </span>
          </div>

          {hasPendingAction ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 transition-all group-hover:translate-x-0.5 dark:text-amber-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              <span>
                {hasJoinRequests
                  ? `${group.pendingJoinRequestsCount} request${(group.pendingJoinRequestsCount || 0) > 1 ? "s" : ""} pending`
                  : "Action needed"}
              </span>
              <ArrowRight className="h-3 w-3" />
            </span>
          ) : isUnread ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 transition-all group-hover:translate-x-0.5 dark:text-emerald-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span>Unread messages</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          ) : (
            <span className="text-foreground flex items-center gap-1 text-xs font-bold transition-all group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              Open Room <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </CardFooter>
      </Card>
    </Link>
  );
}
