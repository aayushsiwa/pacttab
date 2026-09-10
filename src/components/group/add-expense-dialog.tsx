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
  const [splitType, setSplitType] = useState<"equal" | "exact" | "percentage" | "shares">("equal");
  const [exactValues, setExactValues] = useState<Record<string, string>>({});
  const [percentValues, setPercentValues] = useState<Record<string, string>>({});
  const [shareValues, setShareValues] = useState<Record<string, string>>({});
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const numAmount = parseFloat(amount) || 0;
  const participantCount = participantIds.length;
  const perPerson = participantCount > 0 && numAmount > 0 ? (numAmount / participantCount).toFixed(2) : "0.00";

  // Compute live validation metrics
  const exactSum = participantIds.reduce((sum, id) => sum + (parseFloat(exactValues[id]) || 0), 0);
  const exactRemaining = Math.round((numAmount - exactSum) * 100) / 100;

  const percentSum = participantIds.reduce((sum, id) => sum + (parseFloat(percentValues[id]) || 0), 0);
  const percentRemaining = Math.round((100 - percentSum) * 100) / 100;

  const totalShares = participantIds.reduce((sum, id) => sum + (parseInt(shareValues[id], 10) || 1), 0);

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
    formData.append("splitType", splitType);

    participantIds.forEach((id) => formData.append("participantUserIds", id));

    if (splitType === "exact") {
      if (Math.abs(exactRemaining) > 0.01) {
        setError(`Exact splits must sum to ₹${numAmount.toFixed(2)}. Difference: ₹${exactRemaining.toFixed(2)}`);
        return;
      }
      const customSplits = participantIds.map((id) => ({
        userId: id,
        amount: parseFloat(exactValues[id]) || 0,
      }));
      formData.append("customSplits", JSON.stringify(customSplits));
    } else if (splitType === "percentage") {
      if (Math.abs(percentRemaining) > 0.01) {
        setError(`Percentages must sum to 100%. Current sum: ${percentSum.toFixed(2)}%`);
        return;
      }
      const customSplits = participantIds.map((id) => ({
        userId: id,
        percentage: parseFloat(percentValues[id]) || 0,
      }));
      formData.append("customSplits", JSON.stringify(customSplits));
    } else if (splitType === "shares") {
      if (totalShares <= 0) {
        setError("Total shares must be greater than zero");
        return;
      }
      const customSplits = participantIds.map((id) => ({
        userId: id,
        shares: parseInt(shareValues[id], 10) || 1,
      }));
      formData.append("customSplits", JSON.stringify(customSplits));
    }

    startTransition(async () => {
      const res = await createExpenseAction(null, formData);
      if (res.success) {
        toast.success(`Added expense: ${description}`);
        setOpen(false);
        setDescription("");
        setAmount("");
        setExactValues({});
        setPercentValues({});
        setShareValues({});
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

          {/* Split Mode Selector */}
          <div className="space-y-2">
            <Label>Split Method</Label>
            <div className="grid grid-cols-4 gap-1 p-1 bg-muted/40 rounded-xl border border-border/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSplitType("equal")}
                className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  splitType === "equal" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Equal (=)
              </button>
              <button
                type="button"
                onClick={() => setSplitType("exact")}
                className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  splitType === "exact" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Exact (₹)
              </button>
              <button
                type="button"
                onClick={() => setSplitType("percentage")}
                className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  splitType === "percentage" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Percent (%)
              </button>
              <button
                type="button"
                onClick={() => setSplitType("shares")}
                className={`py-1.5 px-2 rounded-lg text-center transition-all cursor-pointer ${
                  splitType === "shares" ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Shares (⚖️)
              </button>
            </div>
          </div>

          {/* Participant Selection & Split Inputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                {splitType === "equal"
                  ? `Split Equally Between (${participantCount})`
                  : `Participants (${participantCount})`}
              </Label>
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

            {splitType === "equal" ? (
              <>
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
              </>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border p-2 bg-muted/20">
                {members.map((m) => {
                  const isSelected = participantIds.includes(m.id);
                  const shareVal = parseInt(shareValues[m.id], 10) || 1;
                  const estimatedShareRupees = totalShares > 0 && numAmount > 0 && isSelected
                    ? ((shareVal / totalShares) * numAmount).toFixed(2)
                    : "0.00";

                  return (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between gap-3 p-2 rounded-lg border text-xs ${
                        isSelected ? "bg-background border-border/80" : "opacity-50 border-transparent"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleParticipant(m.id)}
                        className="flex items-center gap-2 text-left font-medium min-w-0 flex-1"
                      >
                        <div
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-input"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3" />}
                        </div>
                        <span className="truncate">@{m.username}</span>
                      </button>

                      {isSelected && splitType === "exact" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-muted-foreground">₹</span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={exactValues[m.id] ?? ""}
                            onChange={(e) => setExactValues({ ...exactValues, [m.id]: e.target.value })}
                            className="h-7 w-24 text-xs text-right font-medium"
                          />
                        </div>
                      )}

                      {isSelected && splitType === "percentage" && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder="0"
                            value={percentValues[m.id] ?? ""}
                            onChange={(e) => setPercentValues({ ...percentValues, [m.id]: e.target.value })}
                            className="h-7 w-20 text-xs text-right font-medium"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      )}

                      {isSelected && splitType === "shares" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground">≈ ₹{estimatedShareRupees}</span>
                          <Input
                            type="number"
                            step="1"
                            min="1"
                            value={shareValues[m.id] ?? "1"}
                            onChange={(e) => setShareValues({ ...shareValues, [m.id]: e.target.value })}
                            className="h-7 w-16 text-xs text-center font-medium"
                          />
                          <span className="text-[11px] text-muted-foreground">shr</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Validation status bar */}
                {splitType === "exact" && (
                  <div
                    className={`rounded-lg p-2 text-center text-xs font-semibold border ${
                      Math.abs(exactRemaining) < 0.01
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    Allocated: ₹{exactSum.toFixed(2)} of ₹{numAmount.toFixed(2)}{" "}
                    {Math.abs(exactRemaining) < 0.01 ? (
                      "• ✓ Exact Match"
                    ) : (
                      <span>• Remaining: <strong>₹{exactRemaining.toFixed(2)}</strong></span>
                    )}
                  </div>
                )}

                {splitType === "percentage" && (
                  <div
                    className={`rounded-lg p-2 text-center text-xs font-semibold border ${
                      Math.abs(percentRemaining) < 0.01
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    Allocated: {percentSum.toFixed(1)}% of 100%{" "}
                    {Math.abs(percentRemaining) < 0.01 ? (
                      "• ✓ 100% Match"
                    ) : (
                      <span>• Remaining: <strong>{percentRemaining.toFixed(1)}%</strong></span>
                    )}
                  </div>
                )}

                {splitType === "shares" && (
                  <div className="rounded-lg p-2 text-center text-xs text-muted-foreground bg-muted/60 border">
                    Total Shares: <strong className="text-foreground">{totalShares}</strong> • Each share ≈{" "}
                    <strong className="text-foreground">
                      ₹{totalShares > 0 && numAmount > 0 ? (numAmount / totalShares).toFixed(2) : "0.00"}
                    </strong>
                  </div>
                )}
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
