"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createInviteLinkAction,
  revokeInviteLinkAction,
  rotateInviteLinkAction,
  reviewJoinRequestAction,
} from "@/actions/groups";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Users,
  Link2,
  Copy,
  Check,
  Trash2,
  Plus,
  Lock,
  RotateCw,
  Clock,
  ShieldCheck,
  UserCheck,
  UserX,
} from "lucide-react";
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
  expiresAt: Date | null;
  requiresApproval: boolean;
}

interface PendingJoinRequest {
  id: string;
  userId: string;
  username: string;
  createdAt: Date;
}

interface MembersViewProps {
  groupId: string;
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
  invites: Invite[];
  pendingJoinRequests?: PendingJoinRequest[];
}

export function MembersView({
  groupId,
  currentUserId,
  currentUserRole,
  members,
  invites,
  pendingJoinRequests = [],
}: MembersViewProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customSlug, setCustomSlug] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<number | null>(null);
  const [maxUses, setMaxUses] = useState<number | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const router = useRouter();
  const isAdmin = currentUserRole === "admin";

  const handleCopy = (token: string) => {
    const fullUrl = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    toast.success("Invite link copied to clipboard!");
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleCreateCustomInvite = () => {
    startTransition(async () => {
      const res = await createInviteLinkAction(groupId, {
        expiresInHours,
        maxUses,
        requiresApproval,
        customSlug: customSlug.trim() || undefined,
      });
      if (res.success && res.token) {
        toast.success("Generated new invite link!");
        setIsCreateModalOpen(false);
        setCustomSlug("");
        handleCopy(res.token);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to create invite link");
      }
    });
  };

  const handleRotateInvite = () => {
    startTransition(async () => {
      const res = await rotateInviteLinkAction(groupId);
      if (res.success && res.token) {
        toast.success("Rotated invite link! Previous links invalidated.");
        handleCopy(res.token);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to rotate invite link");
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

  const handleReviewRequest = (requestId: string, decision: "approved" | "declined") => {
    startTransition(async () => {
      const res = await reviewJoinRequestAction(groupId, requestId, decision);
      if (res.success) {
        toast.success(
          decision === "approved"
            ? "Member approved and added to group!"
            : "Join request declined."
        );
        router.refresh();
      } else {
        toast.error(res.error || "Failed to process request");
      }
    });
  };

  return (
    <div className="space-y-6 w-fit md:min-w-2xl">
      {/* Pending Join Requests Queue for Admins */}
      {isAdmin && pendingJoinRequests.length > 0 && (
        <Card className="border border-amber-500/30 bg-amber-500/5 shadow-2xs rounded-2xl pt-2 md:pt-5">
          <CardHeader className="pt-0 md:p-5 pb-1 md:pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Pending Join Requests ({pendingJoinRequests.length})</span>
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  These users clicked an invite link that requires admin approval.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10">
                Action Required
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 md:p-5 pt-0 space-y-2">
            {pendingJoinRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-xl border border-amber-500/20 bg-background/80 hover:bg-background transition-colors gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar username={req.username} size="md" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm truncate">
                      @{req.username}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Requested {formatRelativeTime(req.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleReviewRequest(req.id, "approved")}
                    className="h-8 px-3 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Approve</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleReviewRequest(req.id, "declined")}
                    className="h-8 px-2.5 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    <span>Decline</span>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Member Directory */}
      <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl pt-2 md:pt-5">
        <CardHeader className="pt-0 md:p-5 pb-1 md:pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Group Members ({members.length})</span>
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                Only active members can participate in chat, expenses, and
                settlements.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-5 pt-0 space-y-1 md:space-y-2.5">
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
                    <div className="flex items-center gap-0.5 md:gap-1.5 font-bold text-xs sm:text-sm truncate">
                      <span>@{m.username}</span>
                      {isMe && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] py-0 px-1.5 font-semibold"
                        >
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
        <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl pt-2 md:pt-5">
          <CardHeader className="pt-0 md:p-5 pb-1 md:pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <span>Invite Links</span>
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  Configure expiry windows, usage limits, or require admin approval.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRotateInvite}
                  disabled={isPending}
                  className="gap-1.5 shrink-0 text-xs font-semibold rounded-xl h-9 px-3 border-border/80"
                  title="Revoke active invites and generate a fresh one immediately"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Rotate</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  disabled={isPending}
                  className="gap-1.5 shrink-0 font-bold rounded-xl h-9 px-3.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New Link</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 md:p-5 pt-0 space-y-1 md:space-y-3 ">
            {invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed border-border/80 rounded-xl bg-card/30">
                <Link2 className="h-6 w-6 mb-2 opacity-40 text-primary" />
                <p className="text-xs font-bold text-foreground">
                  No active invite links
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Generate a link to invite new members to this group.
                </p>
              </div>
            ) : (
              invites.map((inv) => {
                const isCopied = copiedToken === inv.token;
                const isExpired = inv.expiresAt && new Date(inv.expiresAt) < new Date();
                const isCapped = inv.maxUses !== null && inv.useCount >= inv.maxUses;

                return (
                  <div
                    key={inv.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/60 bg-muted/20"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-foreground truncate bg-card px-2.5 py-1 rounded-lg border border-border/60 inline-block max-w-full font-medium">
                          .../join/{inv.token}
                        </span>

                        {!/^[0-9a-f]{32}$/.test(inv.token) && (
                          <Badge variant="outline" className="text-[10px] font-semibold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                            Custom Code
                          </Badge>
                        )}

                        {inv.requiresApproval && (
                          <Badge variant="outline" className="text-[10px] font-semibold border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10">
                            Approval Required
                          </Badge>
                        )}

                        {isExpired && (
                          <Badge variant="destructive" className="text-[10px] font-semibold">
                            Expired
                          </Badge>
                        )}

                        {isCapped && (
                          <Badge variant="destructive" className="text-[10px] font-semibold">
                            Capped
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span>
                          {inv.maxUses !== null
                            ? `${inv.useCount} of ${inv.maxUses} uses`
                            : `Used ${inv.useCount} ${inv.useCount === 1 ? "time" : "times"}`}
                        </span>
                        <span>•</span>
                        {inv.expiresAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {isExpired
                              ? `Expired ${formatRelativeTime(inv.expiresAt)}`
                              : `Expires ${formatRelativeTime(inv.expiresAt)}`}
                          </span>
                        ) : (
                          <span>No expiration</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(inv.token)}
                        className={`gap-1.5 text-xs font-semibold rounded-lg h-8 px-3 ${
                          isCopied
                            ? "border-emerald-500 text-emerald-600 bg-emerald-500/10"
                            : ""
                        }`}
                      >
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{isCopied ? "Copied" : "Copy"}</span>
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

      {/* Custom Invite Link Creation Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border-border/80 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              <span>Create Invite Link</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Customize link expiration, usage limits, and approval requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Custom Link Slug / Code */}
            <div className="space-y-1.5">
              <Label htmlFor="custom-slug-input" className="text-xs font-semibold flex items-center justify-between">
                <span>Custom Invite Code (Optional)</span>
                <span className="text-[10px] text-muted-foreground font-normal">3–50 chars</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono select-none pointer-events-none">
                  /join/
                </span>
                <Input
                  id="custom-slug-input"
                  value={customSlug}
                  onChange={(e) =>
                    setCustomSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^a-z0-9_-]/g, "")
                    )
                  }
                  placeholder="e.g. goa-trip-2026"
                  maxLength={50}
                  className="pl-14 text-xs font-mono rounded-xl bg-card"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Letters, numbers, hyphens (-), and underscores (_). Leave blank to generate a random code.
              </p>
            </div>

            {/* Expiration */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expiration Window</Label>
              <select
                value={expiresInHours ?? "never"}
                onChange={(e) =>
                  setExpiresInHours(
                    e.target.value === "never" ? null : Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="never">Never expires</option>
                <option value="24">24 Hours</option>
                <option value="168">7 Days</option>
                <option value="720">30 Days</option>
              </select>
            </div>

            {/* Max Uses */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Maximum Uses</Label>
              <select
                value={maxUses ?? "unlimited"}
                onChange={(e) =>
                  setMaxUses(
                    e.target.value === "unlimited" ? null : Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="unlimited">Unlimited uses</option>
                <option value="1">1 use (Single use)</option>
                <option value="5">5 uses</option>
                <option value="10">10 uses</option>
                <option value="25">25 uses</option>
              </select>
            </div>

            {/* Requires Approval */}
            <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
              <input
                id="require-approval-check"
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="h-4 w-4 rounded border-border text-emerald-600 focus:ring-emerald-500 mt-0.5"
              />
              <label
                htmlFor="require-approval-check"
                className="text-xs cursor-pointer select-none"
              >
                <span className="font-bold text-foreground block">
                  Require Admin Approval
                </span>
                <span className="text-muted-foreground block text-[11px] mt-0.5 leading-relaxed">
                  Anyone who visits this link must submit a join request for you to approve before gaining access.
                </span>
              </label>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleCreateCustomInvite}
              className="rounded-xl text-xs font-bold"
            >
              {isPending ? "Creating..." : "Generate Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
