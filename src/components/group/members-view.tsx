"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInviteLinkAction, revokeInviteLinkAction } from "@/actions/groups";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Link2, Copy, Check, Trash2, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/date";
import { UserAvatar } from "@/components/ui/user-avatar";

interface Member {
  id: string;
  username: string;
  role: string;
  joinedAt: Date;
}

interface Invite {
  id: string;
  token: string;
  createdAt: Date;
  useCount: number;
  maxUses: number | null;
}

interface MembersViewProps {
  groupId: string;
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
  invites: Invite[];
}

export function MembersView({
  groupId,
  currentUserId,
  currentUserRole,
  members,
  invites,
}: MembersViewProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isAdmin = currentUserRole === "admin";

  const handleCopy = (token: string) => {
    const fullUrl = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCreateInvite = () => {
    startTransition(async () => {
      const res = await createInviteLinkAction(groupId);
      if (res.success && res.token) {
        toast.success("Generated new invite link!");
        handleCopy(res.token);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to create invite link");
      }
    });
  };

  const handleRevokeInvite = (inviteId: string) => {
    startTransition(async () => {
      const res = await revokeInviteLinkAction(groupId, inviteId);
      if (res.success) {
        toast.success("Revoked invite link");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to revoke invite link");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Member Directory */}
      <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Group Members ({members.length})</span>
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Only active members can participate in chat, expenses, and settlements.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-0 space-y-2.5">
          {members.map((m) => {
            const isMe = m.id === currentUserId;

            return (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar username={m.username} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm truncate">
                      <span>@{m.username}</span>
                      {isMe && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Joined {formatRelativeTime(m.joinedAt)}
                    </div>
                  </div>
                </div>

                <Badge
                  variant={m.role === "admin" ? "default" : "secondary"}
                  className={`text-[10px] uppercase font-bold tracking-wider rounded-full px-2.5 py-0.5 ${
                    m.role === "admin"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {m.role}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Invite Management for Admins */}
      {isAdmin ? (
        <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span>Direct Invite Links</span>
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Anyone with an active invite link can join this group immediately without approval.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={handleCreateInvite}
                disabled={isPending}
                className="gap-1.5 shrink-0 font-bold rounded-xl h-9 px-3.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Invite Link</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-5 pt-0 space-y-3">
            {invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-border/80 rounded-xl bg-card/30">
                <Link2 className="h-6 w-6 mb-2 opacity-40 text-primary" />
                <p className="text-xs font-bold text-foreground">No active invite links</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Generate a link to invite new members to this group.
                </p>
              </div>
            ) : (
              invites.map((inv) => {
                const isCopied = copiedToken === inv.token;
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-mono text-xs text-foreground truncate bg-card px-2.5 py-1 rounded-lg border border-border/60 inline-block max-w-full font-medium">
                        .../join/{inv.token}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Used {inv.useCount} {inv.useCount === 1 ? "time" : "times"} • Created {formatRelativeTime(inv.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(inv.token)}
                        className={`gap-1.5 text-xs font-semibold rounded-lg h-8 px-3 ${
                          isCopied ? "border-emerald-500 text-emerald-600 bg-emerald-500/10" : ""
                        }`}
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                        <span>{isCopied ? "Copied" : "Copy Link"}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeInvite(inv.id)}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs font-semibold rounded-lg h-8 px-2.5"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Revoke</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/80 bg-muted/20 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              Invite links and group settings are managed by the group admin.
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
