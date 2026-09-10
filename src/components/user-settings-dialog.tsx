"use client";

import { useState, useTransition } from "react";
import { deleteAccountAction } from "@/actions/auth";
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
import { UserAvatar } from "@/components/ui/user-avatar";
import { Settings, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface UserSettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    username: string;
  };
}

export function UserSettingsDialog({ isOpen, onOpenChange, user }: UserSettingsDialogProps) {
  const [password, setPassword] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDeleteAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Please enter your password to confirm");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("password", password);
      const res = await deleteAccountAction(null, formData);
      if (res?.error) {
        toast.error(res.error);
      }
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-background border-border/80 rounded-2xl p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Settings className="text-foreground h-5 w-5" />
              <span>Account Settings</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Manage your personal profile and account credentials.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-2">
            {/* User Profile Card */}
            <div className="border-border/60 bg-muted/20 flex items-center gap-3.5 rounded-xl border p-3.5">
              <UserAvatar username={user.username} size="lg" />
              <div>
                <p className="text-foreground text-sm font-bold">@{user.username}</p>
                <p className="text-muted-foreground text-[11px]">Zero-Data Architecture Account</p>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="border-destructive/20 space-y-3 border-t pt-4">
              <div>
                <h3 className="text-destructive flex items-center gap-1.5 text-xs font-bold">
                  <Trash2 className="h-4 w-4" />
                  <span>Delete Account Permanently</span>
                </h3>
                <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
                  Permanently erase your account and all associated sessions and memberships. This
                  action cannot be undone.
                </p>
              </div>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsConfirmOpen(true)}
                className="gap-1.5 rounded-xl text-xs font-bold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Account</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-authentication & Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-background border-destructive/40 rounded-2xl p-6 shadow-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-base font-bold">
              <ShieldAlert className="text-destructive h-4 w-4" />
              <span>Confirm Account Deletion</span>
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              To permanently delete your account, please enter your password. This action cannot be
              reversed.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleDeleteAccount} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="delete-account-password" className="text-xs font-semibold">
                Password
              </Label>
              <Input
                id="delete-account-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your current password"
                className="rounded-xl text-xs"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={isPending || !password}
                className="rounded-xl text-xs font-bold"
              >
                {isPending ? "Deleting Account..." : "Permanently Delete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
