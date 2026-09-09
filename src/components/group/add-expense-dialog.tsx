"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createExpenseAction } from "@/actions/expenses";
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
import { Plus, Receipt, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  username: string;
}

interface AddExpenseDialogProps {
  groupId: string;
  currentUserId: string;
  members: Member[];
}

export function AddExpenseDialog({ groupId, currentUserId, members }: AddExpenseDialogProps) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [participantIds, setParticipantIds] = useState<string[]>(members.map((m) => m.id));
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const numAmount = parseFloat(amount) || 0;
  const participantCount = participantIds.length;
  const perPerson = participantCount > 0 && numAmount > 0 ? (numAmount / participantCount).toFixed(2) : "0.00";

  const handleToggleParticipant = (userId: string) => {
    if (participantIds.includes(userId)) {
      if (participantIds.length > 1) {
        setParticipantIds(participantIds.filter((id) => id !== userId));
      } else {
        toast.info("At least one person must be included in the split");
      }
    } else {
      setParticipantIds([...participantIds, userId]);
    }
  };

  const handleSelectAll = () => {
    setParticipantIds(members.map((m) => m.id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!description.trim()) {
      setError("Please provide an expense description");
      return;
    }

    if (numAmount <= 0) {
      setError("Please enter an amount greater than 0");
      return;
    }

    if (participantIds.length === 0) {
      setError("Please select at least one participant");
      return;
    }

    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("description", description.trim());
    formData.append("amount", numAmount.toString());
    formData.append("paidByUserId", paidByUserId);
    formData.append("expenseDate", expenseDate);
    participantIds.forEach((id) => formData.append("participantUserIds", id));

    startTransition(async () => {
      const res = await createExpenseAction(null, formData);
      if (res.success) {
        toast.success(`Added expense: ${description}`);
        setOpen(false);
        setDescription("");
        setAmount("");
        setParticipantIds(members.map((m) => m.id));
        router.refresh();
      } else {
        setError(res.error || "Failed to add expense");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-1.5 shadow-xs font-medium" />}>
        <Plus className="h-4 w-4" />
        <span>Add Expense</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <span>Add Shared Expense</span>
          </DialogTitle>
          <DialogDescription>
            Split costs equally among chosen group members.
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
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Groceries, Dinner, Taxi, Airbnb"
              required
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
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

            <div className="space-y-2">
              <Label htmlFor="expenseDate">Date</Label>
              <Input
                id="expenseDate"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidBy">Paid By</Label>
            <select
              id="paidBy"
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
            <div className="flex items-center justify-between">
              <Label>Split Equally Between ({participantCount})</Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleSelectAll}
                className="text-[11px] h-6 text-muted-foreground"
              >
                Select All
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto rounded-lg border p-2 bg-muted/20">
              {members.map((m) => {
                const isSelected = participantIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleParticipant(m.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background border-transparent text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <span className="truncate">@{m.username}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {numAmount > 0 && participantCount > 0 && (
              <div className="rounded-lg bg-muted/60 p-2.5 text-center text-xs text-muted-foreground">
                Equal Split: <strong className="text-foreground">₹{perPerson}</strong> per person ({participantCount} {participantCount === 1 ? "person" : "people"})
              </div>
            )}
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
              {isPending ? "Adding..." : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
