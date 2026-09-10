"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateGroupAction,
  transferAdminAction,
  leaveGroupAction,
  deleteGroupAction,
} from "@/actions/groups";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  ShieldAlert,
  LogOut,
  Trash2,
  UserCheck,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  username: string;
  role: string;
}

interface GroupSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
  groupDescription: string | null;
  currentUserId: string;
  currentUserRole: string;
  members: Member[];
  userNetBalance: number;
}

export function GroupSettingsDialog({
  isOpen,
  onOpenChange,
  groupId,
  groupName,
  groupDescription,
  currentUserId,
  currentUserRole,
  members,
  userNetBalance,
}: GroupSettingsDialogProps) {
  const [name, setName] = useState(groupName);
  const [description, setDescription] = useState(groupDescription || "");
  const [selectedAdminId, setSelectedAdminId] = useState("");
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const isAdmin = currentUserRole === "admin";
  const otherMembers = members.filter((m) => m.id !== currentUserId);

  const hasUnsettledBalance = Math.abs(userNetBalance) > 0.01;
  const isBlockedFromLeaving =
    hasUnsettledBalance || (isAdmin && otherMembers.length > 0);

  const handleUpdateDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Group name cannot be empty");
      return;
    }

    startTransition(async () => {
      const res = await updateGroupAction(groupId, name, description);
      if (res.success) {
        toast.success("Group details updated!");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update group details");
      }
    });
  };

  const handleTransferAdmin = () => {
    if (!selectedAdminId) {
      toast.error("Please select a member to transfer admin rights to");
      return;
    }

    startTransition(async () => {
      const res = await transferAdminAction(groupId, selectedAdminId);
      if (res.success) {
        toast.success("Admin rights transferred successfully!");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to transfer admin rights");
      }
    });
  };

  const handleLeaveGroup = () => {
    startTransition(async () => {
      const res = await leaveGroupAction(groupId);
      if (res.success) {
        toast.success("You have left the group.");
        setIsConfirmLeaveOpen(false);
        onOpenChange(false);
        router.push("/groups");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to leave group");
      }
    });
  };

  const handleDeleteGroup = () => {
    startTransition(async () => {
      const res = await deleteGroupAction(groupId);
      if (res.success) {
        toast.success("Group deleted permanently.");
        setIsConfirmDeleteOpen(false);
        onOpenChange(false);
        router.push("/groups");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete group");
      }
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6 bg-background border-border/80 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Settings className="h-5 w-5 text-foreground" />
              <span>Group Settings</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage group info, member permissions, and group lifecycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* 1. Group Details Form */}
            {isAdmin ? (
              <form onSubmit={handleUpdateDetails} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="group-name" className="text-xs font-semibold">
                    Group Name
                  </Label>
                  <Input
                    id="group-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Trip to Goa, Apartment 402..."
                    className="text-xs rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="group-desc" className="text-xs font-semibold">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short summary or purpose of this group..."
                    rows={2}
                    className="text-xs rounded-xl resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  className="rounded-xl text-xs font-bold"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            ) : (
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1">
                <p className="text-xs font-bold text-foreground">{groupName}</p>
                {groupDescription && (
                  <p className="text-[11px] text-muted-foreground">{groupDescription}</p>
                )}
              </div>
            )}

            {/* 2. Admin Transfer Section */}
            {isAdmin && otherMembers.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-border/60">
                <div>
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                    <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Transfer Admin Rights</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Assign another active member as the group administrator. You will become a regular member.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Select a member...</option>
                    {otherMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        @{m.username} ({m.role})
                      </option>
                    ))}
                  </select>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedAdminId || isPending}
                    onClick={handleTransferAdmin}
                    className="rounded-xl text-xs font-semibold shrink-0"
                  >
                    Transfer
                  </Button>
                </div>
              </div>
            )}

            {/* 3. Leave Group Section */}
            <div className="space-y-3 pt-4 border-t border-border/60">
              <div>
                <h3 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  <span>Leave Group</span>
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Leaving removes you from chat and prevents new expense assignments.
                </p>
              </div>

              {hasUnsettledBalance ? (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">
                      Balance must be ₹0.00 to leave
                    </span>
                    <span className="text-[11px] opacity-90 block mt-0.5">
                      {userNetBalance > 0
                        ? `You are owed ₹${userNetBalance.toFixed(2)}. Settle up with other members before leaving.`
                        : `You owe ₹${Math.abs(userNetBalance).toFixed(2)}. Please settle all debts before leaving.`}
                    </span>
                  </div>
                </div>
              ) : isAdmin && otherMembers.length > 0 ? (
                <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200 text-xs flex items-start gap-2.5">
                  <Info className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">Admin Transfer Required</span>
                    <span className="text-[11px] opacity-90 block mt-0.5">
                      As the administrator, you must transfer group admin rights to another member before you can leave.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 text-[10px]">
                      Balance ₹0.00
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">Ready to leave</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBlockedFromLeaving || isPending}
                    onClick={() => setIsConfirmLeaveOpen(true)}
                    className="text-xs font-semibold rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                  >
                    Leave Group
                  </Button>
                </div>
              )}
            </div>

            {/* 4. Danger Zone: Delete Group (Admin only) */}
            {isAdmin && (
              <div className="space-y-3 pt-4 border-t border-destructive/20">
                <div>
                  <h3 className="text-xs font-bold flex items-center gap-1.5 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Group Permanently</span>
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Irreversibly delete this group, along with all recorded expenses, splits, settlements, and chat messages.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="rounded-xl text-xs font-bold gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete This Group</span>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal for Leaving */}
      <Dialog open={isConfirmLeaveOpen} onOpenChange={setIsConfirmLeaveOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border-border/80 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <LogOut className="h-4 w-4 text-muted-foreground" />
              <span>Confirm Leaving Group</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to leave <strong>{groupName}</strong>? You will need an invite link to rejoin.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmLeaveOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleLeaveGroup}
              className="rounded-xl text-xs font-bold"
            >
              {isPending ? "Leaving..." : "Leave Group"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal for Group Deletion */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-background border-destructive/40 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              <span>Permanently Delete Group</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will permanently delete <strong>{groupName}</strong> and purge all chat logs, expense records, splits, and settlements. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfirmDeleteOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isPending}
              onClick={handleDeleteGroup}
              className="rounded-xl text-xs font-bold"
            >
              {isPending ? "Deleting..." : "Permanently Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
