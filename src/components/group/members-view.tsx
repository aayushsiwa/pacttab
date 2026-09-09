"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createInviteLinkAction, revokeInviteLinkAction } from "@/actions/groups";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Link2, Copy, Check, Trash2, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

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
      <Card className="border shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Group Members ({members.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Only active members can participate in chat, expenses, and settlements.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {members.map((m) => {
            const isMe = m.id === currentUserId;
            return (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card/60"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground border">
                    {m.username.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 font-medium text-sm">
                      <span>@{m.username}</span>
                      {isMe && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-normal">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                </div>

                <Badge
                  variant={m.role === "admin" ? "default" : "secondary"}
                  className="text-[10px] uppercase font-semibold"
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
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span>Direct Invite Links</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Anyone with an active invite link can join this group immediately without approval.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={handleCreateInvite}
                disabled={isPending}
                className="gap-1.5 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Invite Link</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg">
                <Link2 className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-xs font-medium">No active invite links</p>
                <p className="text-[11px] mt-0.5">
                  Generate a link to invite new members to this group.
                </p>
              </div>
            ) : (
              invites.map((inv) => {
                const isCopied = copiedToken === inv.token;
                return (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card/60"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="font-mono text-xs text-foreground truncate bg-muted/50 px-2 py-1 rounded-sm border inline-block max-w-full">
                        .../join/{inv.token}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Used {inv.useCount} {inv.useCount === 1 ? "time" : "times"} • Created {new Date(inv.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => handleCopy(inv.token)}
                        className="gap-1 text-xs"
                      >
                        {isCopied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        <span>{isCopied ? "Copied" : "Copy Link"}</span>
                      </Button>

                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleRevokeInvite(inv.id)}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                      >
                        <Trash2 className="h-3 w-3" />
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
        <Card className="border bg-muted/20">
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
