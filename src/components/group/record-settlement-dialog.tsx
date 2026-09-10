"use client";

import { useState, useTransition } from "react";
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

function SettlementForm({
  groupId,
  currentUserId,
  members,
  prefill,
  onClose,
}: {
  groupId: string;
  currentUserId: string;
  members: Member[];
  prefill?: {
    payerId?: string;
    recipientId?: string;
    amount?: number;
  };
  onClose: () => void;
}) {
  const defaultPayer =
    prefill?.payerId || members.find((m) => m.id === currentUserId)?.id || members[0]?.id || "";
  const defaultRecipient =
    prefill?.recipientId || members.find((m) => m.id !== defaultPayer)?.id || "";

  const [paidByUserId, setPaidByUserId] = useState(defaultPayer);
  const [receivedByUserId, setReceivedByUserId] = useState(defaultRecipient);
  const [amount, setAmount] = useState(prefill?.amount ? prefill.amount.toString() : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

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
        const counterpartyName = currentUserId === paidByUserId ? recipientName : payerName;
        toast.success(`Settlement recorded! Waiting for @${counterpartyName} to confirm.`);
        onClose();
        router.refresh();
      } else {
        setError(res.error || "Failed to record settlement");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="border-primary/20 bg-primary/5 text-muted-foreground rounded-xl border p-3 text-xs leading-relaxed">
        💡 <strong>Mutual Affirmation:</strong> Once recorded, the other member will be prompted to
        confirm this payment. Net balances will update as soon as they confirm.
      </div>

      {error && (
        <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg border p-3 text-xs">
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
          className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
          className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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

      <DialogFooter className="gap-2 pt-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Recording..." : "Save Settlement"}
        </Button>
      </DialogFooter>
    </form>
  );
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

  const formKey = `${prefill?.payerId || ""}-${prefill?.recipientId || ""}-${prefill?.amount || ""}-${open}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement} />
      ) : (
        <DialogTrigger
          render={<Button variant="outline" className="gap-1.5 font-medium shadow-xs" />}
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Record Settlement</span>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="text-primary h-5 w-5" />
            <span>Record a Settlement</span>
          </DialogTitle>
          <DialogDescription>
            Record when someone transfers or pays back money directly to another member.
          </DialogDescription>
        </DialogHeader>

        <SettlementForm
          key={formKey}
          groupId={groupId}
          currentUserId={currentUserId}
          members={members}
          prefill={prefill}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
