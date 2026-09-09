"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSettlementAction } from "@/actions/expenses";
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
import { ArrowLeftRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  username: string;
}

interface RecordSettlementDialogProps {
  groupId: string;
  currentUserId: string;
  members: Member[];
  prefill?: {
    payerId?: string;
    recipientId?: string;
    amount?: number;
  };
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function RecordSettlementDialog({
  groupId,
  currentUserId,
  members,
  prefill,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: RecordSettlementDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const defaultPayer = prefill?.payerId || (members.find((m) => m.id === currentUserId)?.id || members[0]?.id || "");
  const defaultRecipient = prefill?.recipientId || (members.find((m) => m.id !== defaultPayer)?.id || "");

  const [paidByUserId, setPaidByUserId] = useState(defaultPayer);
  const [receivedByUserId, setReceivedByUserId] = useState(defaultRecipient);
  const [amount, setAmount] = useState(prefill?.amount ? prefill.amount.toString() : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (prefill) {
      if (prefill.payerId) setPaidByUserId(prefill.payerId);
      if (prefill.recipientId) setReceivedByUserId(prefill.recipientId);
      if (prefill.amount) setAmount(prefill.amount.toString());
    }
  }, [prefill]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0) {
      setError("Please enter an amount greater than 0");
      return;
    }

    if (paidByUserId === receivedByUserId) {
      setError("Payer and recipient cannot be the same person");
      return;
    }

    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("paidByUserId", paidByUserId);
    formData.append("receivedByUserId", receivedByUserId);
    formData.append("amount", numAmount.toString());

    startTransition(async () => {
      const res = await recordSettlementAction(null, formData);
      if (res.success) {
        const payerName = members.find((m) => m.id === paidByUserId)?.username || "Member";
        const recipientName = members.find((m) => m.id === receivedByUserId)?.username || "Member";
        toast.success(`Recorded ₹${numAmount.toFixed(2)} settlement from @${payerName} to @${recipientName}`);
        setOpen(false);
        setAmount("");
        router.refresh();
      } else {
        setError(res.error || "Failed to record settlement");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as any} />
      ) : (
        <DialogTrigger render={<Button variant="outline" className="gap-1.5 shadow-xs font-medium" />}>
          <ArrowLeftRight className="h-4 w-4" />
          <span>Record Settlement</span>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            <span>Record a Settlement</span>
          </DialogTitle>
          <DialogDescription>
            Record when someone transfers or pays back money directly to another member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payer">Who paid?</Label>
            <select
              id="payer"
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isPending}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  @{m.username} {m.id === currentUserId ? "(You)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipient">Who received the payment?</Label>
            <select
              id="recipient"
              value={receivedByUserId}
              onChange={(e) => setReceivedByUserId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              disabled={isPending}
            >
              {members
                .filter((m) => m.id !== paidByUserId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    @{m.username} {m.id === currentUserId ? "(You)" : ""}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settleAmount">Amount (₹)</Label>
            <Input
              id="settleAmount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              disabled={isPending}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Recording..." : "Save Settlement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
