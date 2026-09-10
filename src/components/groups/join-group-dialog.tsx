"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinGroupAction } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, AlertCircle } from "lucide-react";

export function JoinGroupDialog() {
  const [open, setOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Extract token if user pasted full URL
    let token = tokenInput.trim();
    if (token.includes("/join/")) {
      token = token.split("/join/")[1]?.split("?")[0]?.split("/")[0] || token;
    }

    if (!token) {
      setError("Please enter a valid invite token or link");
      return;
    }

    startTransition(async () => {
      const res = await joinGroupAction(token);
      if (res.success && res.groupId) {
        setOpen(false);
        setTokenInput("");
        router.push(`/group/${res.groupId}`);
      } else {
        setError(res.error || "Failed to join group");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="gap-1.5 font-medium" />}>
        <Link2 className="h-4 w-4" />
        <span>Join with Invite</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join a Group</DialogTitle>
          <DialogDescription>
            Enter the invite token or paste the invite link shared with you by a group admin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleJoin} className="space-y-4 pt-2">
          {error && (
            <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="token">Invite Link or Token</Label>
            <Input
              id="token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="e.g. 7f8a9b2c... or https://.../join/..."
              required
              disabled={isPending}
            />
          </div>

          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Joining..." : "Join Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
