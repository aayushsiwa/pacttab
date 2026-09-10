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
  const isBlockedFromLeaving = hasUnsettledBalance || (isAdmin && otherMembers.length > 0);

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
        <DialogContent className="bg-background border-border/80 max-h-[85vh] overflow-y-auto rounded-2xl p-6 shadow-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Settings className="text-foreground h-5 w-5" />
              <span>Group Settings</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
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
                    className="rounded-xl text-xs"
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
                    className="resize-none rounded-xl text-xs"
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
              <div className="border-border/60 bg-muted/20 space-y-1 rounded-xl border p-3.5">
                <p className="text-foreground text-xs font-bold">{groupName}</p>
                {groupDescription && (
                  <p className="text-muted-foreground text-[11px]">{groupDescription}</p>
                )}
              </div>
            )}

            {/* 2. Admin Transfer Section */}
            {isAdmin && otherMembers.length > 0 && (
              <div className="border-border/60 space-y-3 border-t pt-4">
                <div>
                  <h3 className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                    <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Transfer Admin Rights</span>
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Assign another active member as the group administrator. You will become a
                    regular member.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedAdminId}
                    onChange={(e) => setSelectedAdminId(e.target.value)}
                    className="border-border bg-card text-foreground focus:ring-ring flex-1 rounded-xl border px-3 py-2 text-xs focus:ring-2 focus:outline-none"
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
                    className="shrink-0 rounded-xl text-xs font-semibold"
                  >
                    Transfer
                  </Button>
                </div>
              </div>
            )}

            {/* 3. Leave Group Section */}
            <div className="border-border/60 space-y-3 border-t pt-4">
              <div>
                <h3 className="text-foreground flex items-center gap-1.5 text-xs font-bold">
                  <LogOut className="text-muted-foreground h-4 w-4" />
                  <span>Leave Group</span>
                </h3>
                <p className="text-muted-foreground mt-0.5 text-[11px]">
                  Leaving removes you from chat and prevents new expense assignments.
                </p>
              </div>

              {hasUnsettledBalance ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="block font-bold">Balance must be ₹0.00 to leave</span>
                    <span className="mt-0.5 block text-[11px] opacity-90">
                      {userNetBalance > 0
                        ? `You are owed ₹${userNetBalance.toFixed(2)}. Settle up with other members before leaving.`
                        : `You owe ₹${Math.abs(userNetBalance).toFixed(2)}. Please settle all debts before leaving.`}
                    </span>
                  </div>
                </div>
              ) : isAdmin && otherMembers.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-800 dark:text-indigo-200">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <span className="block font-bold">Admin Transfer Required</span>
                    <span className="mt-0.5 block text-[11px] opacity-90">
                      As the administrator, you must transfer group admin rights to another member
                      before you can leave.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="border-border/60 bg-muted/20 flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
                    >
                      Balance ₹0.00
                    </Badge>
                    <span className="text-muted-foreground text-[11px]">Ready to leave</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBlockedFromLeaving || isPending}
                    onClick={() => setIsConfirmLeaveOpen(true)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 rounded-xl text-xs font-semibold"
                  >
                    Leave Group
                  </Button>
                </div>
              )}
            </div>

            {/* 4. Danger Zone: Delete Group (Admin only) */}
            {isAdmin && (
              <div className="border-destructive/20 space-y-3 border-t pt-4">
                <div>
                  <h3 className="text-destructive flex items-center gap-1.5 text-xs font-bold">
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Group Permanently</span>
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    Irreversibly delete this group, along with all recorded expenses, splits,
                    settlements, and chat messages.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isPending}
                  onClick={() => setIsConfirmDeleteOpen(true)}
                  className="gap-1.5 rounded-xl text-xs font-bold"
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
        <DialogContent className="bg-background border-border/80 rounded-2xl p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <LogOut className="text-muted-foreground h-4 w-4" />
              <span>Confirm Leaving Group</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Are you sure you want to leave <strong>{groupName}</strong>? You will need an invite
              link to rejoin.
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
        <DialogContent className="bg-background border-destructive/40 rounded-2xl p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-base font-bold">
              <ShieldAlert className="text-destructive h-4 w-4" />
              <span>Permanently Delete Group</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              This will permanently delete <strong>{groupName}</strong> and purge all chat logs,
              expense records, splits, and settlements. This action cannot be undone.
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
