"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGroups,
  useUserPendingJoinRequests,
  useUserPendingDirectInvites,
} from "@/hooks/queries/use-groups";
import { useCurrentUser } from "@/hooks/queries/use-user";
import { useRespondToDirectInvite } from "@/hooks/mutations";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { JoinGroupDialog } from "@/components/groups/join-group-dialog";
import { GroupCard } from "@/components/groups/group-card";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderPlus, Clock, MailOpen, UserCheck, UserX } from "lucide-react";
import { formatRelativeTime } from "@/lib/date";
import type { PendingRequest, PendingDirectInvite, UserGroup } from "@/types/api";

export default function GroupsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: userGroups } = useGroups<UserGroup[]>();
  const { data: pendingRequests } = useUserPendingJoinRequests<PendingRequest[]>();
  const { data: pendingInvites } = useUserPendingDirectInvites<PendingDirectInvite[]>();
  const { data: user } = useCurrentUser();
  const respondToDirectInvite = useRespondToDirectInvite();

  const handleRespond = (inviteId: string, decision: "accepted" | "declined", groupId: string) => {
    respondToDirectInvite.mutate(
      { inviteId, decision },
      {
        onSuccess: () => {
          if (decision === "accepted") {
            router.push(`/group/${groupId}`);
          } else {
            queryClient.invalidateQueries({ queryKey: ["groups"] });
          }
        },
      }
    );
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your Groups</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Private expense tabs and chat rooms. Only invited members can see what is here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <JoinGroupDialog />
          <CreateGroupDialog />
        </div>
      </div>

      {/* Direct Invites to the Current User */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground flex items-center gap-2 text-base font-bold tracking-tight">
              <MailOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Group Invitations ({pendingInvites.length})</span>
            </h2>
            <Badge
              variant="outline"
              className="rounded-full border-emerald-500/40 bg-emerald-500/10 px-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"
            >
              {pendingInvites.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pendingInvites.map((inv) => (
              <Card
                key={inv.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 shadow-2xs"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-sm font-bold text-emerald-700 shadow-2xs ring-1 ring-emerald-500/30 dark:text-emerald-300">
                        {inv.groupName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-foreground truncate text-base font-bold">
                          {inv.groupName}
                        </CardTitle>
                        <span className="text-muted-foreground text-[11px]">
                          @{inv.inviterUsername} invited you {formatRelativeTime(inv.createdAt)}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400"
                    >
                      Invited
                    </Badge>
                  </div>

                  {inv.groupDescription && (
                    <CardDescription className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                      {inv.groupDescription}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardFooter className="flex items-center justify-between gap-2 border-t border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
                  {inv.expiresAt && (
                    <div className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Expires {formatRelativeTime(inv.expiresAt)}</span>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={respondToDirectInvite.isPending}
                      onClick={() => handleRespond(inv.id, "declined", inv.groupId)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 rounded-lg px-2.5 text-xs font-semibold"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      <span>Deny</span>
                    </Button>
                    <Button
                      size="sm"
                      disabled={respondToDirectInvite.isPending}
                      onClick={() => handleRespond(inv.id, "accepted", inv.groupId)}
                      className="h-8 gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Accept</span>
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pending Group Requests for the Current User */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-foreground flex items-center gap-2 text-base font-bold tracking-tight">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Pending Group Requests ({pendingRequests.length})</span>
            </h2>
            <Badge
              variant="outline"
              className="rounded-full border-amber-500/40 bg-amber-500/10 px-2 text-[10px] font-bold text-amber-600 dark:text-amber-400"
            >
              {pendingRequests.length}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {pendingRequests.map((req) => (
              <Card
                key={req.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-2xs"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-sm font-bold text-amber-700 shadow-2xs ring-1 ring-amber-500/30 dark:text-amber-300">
                        {req.groupName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-foreground truncate text-base font-bold">
                          {req.groupName}
                        </CardTitle>
                        <span className="text-muted-foreground text-[11px]">
                          Requested {formatRelativeTime(req.createdAt)}
                        </span>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400"
                    >
                      Pending
                    </Badge>
                  </div>

                  {req.groupDescription && (
                    <CardDescription className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                      {req.groupDescription}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardFooter className="text-muted-foreground flex items-center justify-between border-t border-amber-500/20 bg-amber-500/10 px-5 py-3 text-xs">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Awaiting admin approval</span>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Groups Grid */}
      <div className="mt-8">
        {userGroups &&
        userGroups.length === 0 &&
        (!pendingRequests || pendingRequests.length === 0) &&
        (!pendingInvites || pendingInvites.length === 0) ? (
          <div className="border-border/80 bg-card/40 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center shadow-2xs">
            <div className="ring-border mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/15 to-indigo-500/15 text-emerald-600 shadow-2xs ring-1 dark:text-emerald-400">
              <FolderPlus className="h-7 w-7" />
            </div>
            <h3 className="text-foreground text-lg font-bold">No groups yet</h3>
            <p className="text-muted-foreground mt-1.5 mb-6 max-w-sm text-xs leading-relaxed sm:text-sm">
              Create your first private group to start tracking shared expenses, or join an existing
              group via an invite link.
            </p>
            <div className="flex items-center gap-3">
              <JoinGroupDialog />
              <CreateGroupDialog />
            </div>
          </div>
        ) : (
          user &&
          userGroups &&
          userGroups.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {userGroups.map((g, idx) => {
                // Deterministic avatar gradient
                const gradients = [
                  "from-emerald-500 to-teal-600",
                  "from-blue-500 to-indigo-600",
                  "from-purple-500 to-pink-600",
                  "from-amber-500 to-orange-600",
                  "from-rose-500 to-red-600",
                ];
                const gradient = gradients[idx % gradients.length];

                return (
                  <GroupCard key={g.id} group={g} currentUserId={user.id} gradient={gradient} />
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
