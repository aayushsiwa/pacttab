"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  confirmSettlementAction,
  rejectSettlementAction,
  cancelSettlementAction,
} from "@/actions/expenses";
import { RecordSettlementDialog } from "@/components/group/record-settlement-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Check,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { MemberBalance, SuggestedSettlement } from "@/lib/balances";
import { formatRelativeTime, formatDate } from "@/lib/date";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "sonner";

export interface SettlementItem {
  id: string;
  amount: string | number;
  paidByUserId: string;
  receivedByUserId: string;
  status: string;
  createdByUserId?: string | null;
  confirmedAt?: Date | null;
  rejectedAt?: Date | null;
  settledAt: Date;
  payerUsername: string;
  recipientUsername: string;
  creatorUsername?: string;
}

interface BalancesViewProps {
  groupId: string;
  currentUserId: string;
  members: { id: string; username: string }[];
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
  settlements: SettlementItem[];
}

export function BalancesView({
  groupId,
  currentUserId,
  members,
  balances,
  suggestedSettlements,
  settlements,
}: BalancesViewProps) {
  const [activePrefill, setActivePrefill] = useState<
    | {
        payerId?: string;
        recipientId?: string;
        amount?: number;
      }
    | undefined
  >(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSettleSuggestion = (s: SuggestedSettlement) => {
    setActivePrefill({
      payerId: s.fromUserId,
      recipientId: s.toUserId,
      amount: s.amount,
    });
    setDialogOpen(true);
  };

  const handleOpenGeneralDialog = () => {
    setActivePrefill(undefined);
    setDialogOpen(true);
  };

  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = (settlementId: string) => {
    setProcessingId(settlementId);
    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("settlementId", settlementId);

    startTransition(async () => {
      const res = await confirmSettlementAction(null, formData);
      setProcessingId(null);
      if (res.success) {
        toast.success("Settlement confirmed! Balances updated.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to confirm settlement");
      }
    });
  };

  const handleReject = (settlementId: string) => {
    setProcessingId(settlementId);
    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("settlementId", settlementId);

    startTransition(async () => {
      const res = await rejectSettlementAction(null, formData);
      setProcessingId(null);
      if (res.success) {
        toast.info("Settlement claim rejected.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to reject settlement");
      }
    });
  };

  const handleCancel = (settlementId: string) => {
    setProcessingId(settlementId);
    const formData = new FormData();
    formData.append("groupId", groupId);
    formData.append("settlementId", settlementId);

    startTransition(async () => {
      const res = await cancelSettlementAction(null, formData);
      setProcessingId(null);
      if (res.success) {
        toast.info("Settlement cancelled.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to cancel settlement");
      }
    });
  };

  const pendingSettlements = settlements.filter((s) => s.status === "pending");

  const myBalance = balances.find((b) => b.userId === currentUserId);
  const myNet = myBalance ? myBalance.netBalance : 0;

  return (
    <div className="space-y-6">
      {/* Pending Affirmations Queue */}
      {pendingSettlements.length > 0 && (
        <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-2xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-300">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              <span>Pending Settlements ({pendingSettlements.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-amber-800/80 dark:text-amber-300/70">
              Settlements require confirmation from the other member before net balances update.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-5 pt-0">
            {pendingSettlements.map((set) => {
              const counterpartyUserId =
                set.createdByUserId === set.paidByUserId ? set.receivedByUserId : set.paidByUserId;
              const isAwaitingMyConfirmation = counterpartyUserId === currentUserId;
              const isMyPendingSubmission = set.createdByUserId === currentUserId;
              const counterpartyUsername =
                counterpartyUserId === set.paidByUserId ? set.payerUsername : set.recipientUsername;
              const isWorking = isPending && processingId === set.id;

              return (
                <div
                  key={set.id}
                  className="bg-background/80 flex flex-col justify-between gap-3 rounded-xl border border-amber-500/20 p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold sm:text-sm">
                      {isAwaitingMyConfirmation ? (
                        <span className="font-extrabold text-amber-600 dark:text-amber-400">
                          Action Required: Affirm payment
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending Confirmation</span>
                      )}
                    </div>
                    <div className="text-foreground text-xs font-medium">
                      @{set.payerUsername} ➔ @{set.recipientUsername}:{" "}
                      <strong className="text-sm font-bold">
                        ₹{Number(set.amount).toFixed(2)}
                      </strong>
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {isAwaitingMyConfirmation
                        ? `Recorded by @${set.creatorUsername || set.payerUsername}. Please confirm if you sent/received this.`
                        : isMyPendingSubmission
                          ? `Waiting for @${counterpartyUsername} to affirm.`
                          : `Recorded by @${set.creatorUsername || set.payerUsername}. Waiting for @${counterpartyUsername}.`}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isAwaitingMyConfirmation && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(set.id)}
                          disabled={isWorking}
                          className="h-8 gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                        >
                          {isWorking ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                          <span>Confirm</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(set.id)}
                          disabled={isWorking}
                          className="text-destructive hover:bg-destructive/10 border-destructive/30 h-8 gap-1 rounded-lg px-3 text-xs font-semibold"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </Button>
                      </>
                    )}

                    {isMyPendingSubmission && !isAwaitingMyConfirmation && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(set.id)}
                        disabled={isWorking}
                        className="text-muted-foreground hover:text-foreground h-8 gap-1 rounded-lg px-3 text-xs font-semibold"
                      >
                        {isWorking ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        <span>Cancel</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Personal Net Position Spotlight Banner */}
      <div
        className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 shadow-2xs sm:flex-row sm:items-center ${
          myNet > 0.009
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200"
            : myNet < -0.009
              ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
              : "bg-muted/40 border-border/80 text-foreground"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black shadow-2xs ${
              myNet > 0.009
                ? "bg-emerald-500 text-white"
                : myNet < -0.009
                  ? "bg-amber-500 text-white"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {myNet > 0.009 ? "+" : myNet < -0.009 ? "-" : "✓"}
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider uppercase opacity-80">
              Your Net Position
            </div>
            <div className="text-2xl font-black tracking-tight sm:text-3xl">
              {myNet > 0.009
                ? `You are owed ₹${myNet.toFixed(2)}`
                : myNet < -0.009
                  ? `You owe ₹${Math.abs(myNet).toFixed(2)}`
                  : "You are all settled up! 🎉"}
            </div>
            <p className="mt-0.5 text-xs opacity-75">
              {myNet > 0.009
                ? "Other members will repay you based on the suggested transfers below."
                : myNet < -0.009
                  ? "Pay your share using UPI or cash, then record it to balance the sheet."
                  : "You have no outstanding debts or receivables in this group."}
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenGeneralDialog}
          className="h-10 shrink-0 gap-2 self-start rounded-xl px-4 font-bold shadow-xs sm:self-center"
        >
          <ArrowLeftRight className="h-4 w-4" />
          <span>Record Settlement</span>
        </Button>
      </div>

      <RecordSettlementDialog
        groupId={groupId}
        currentUserId={currentUserId}
        members={members}
        prefill={activePrefill}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Member Net Balances */}
        <Card className="border-border/80 bg-card/80 rounded-2xl border shadow-2xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold">Net Balances</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Positive means owed money; negative means owes money to group.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5 pt-0">
            {balances.map((b) => {
              const isOwed = b.netBalance > 0.009;
              const owes = b.netBalance < -0.009;
              const isSettled = !isOwed && !owes;
              const isMe = b.userId === currentUserId;

              return (
                <div
                  key={b.userId}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                    isMe
                      ? "bg-primary/5 border-primary/25 shadow-2xs"
                      : "bg-muted/20 border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar username={b.username} size="default" />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 truncate text-xs font-bold sm:text-sm">
                        <span>@{b.username}</span>
                        {isMe && (
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 text-[10px] font-semibold"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground truncate text-[11px]">
                        Paid ₹{b.totalPaid.toFixed(2)} • Share ₹{b.totalOwed.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isOwed && (
                      <span className="inline-flex items-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-black text-emerald-600 sm:text-sm dark:text-emerald-400">
                        +₹{b.netBalance.toFixed(2)}
                      </span>
                    )}
                    {owes && (
                      <span className="inline-flex items-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-black text-amber-600 sm:text-sm dark:text-amber-400">
                        -₹{Math.abs(b.netBalance).toFixed(2)}
                      </span>
                    )}
                    {isSettled && (
                      <span className="text-muted-foreground bg-muted/60 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Settled
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Suggested Repayments */}
        <Card className="border-border/80 bg-card/80 rounded-2xl border shadow-2xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold">Suggested Repayments</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Minimum transfers computed to settle all debts with zero leftovers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 p-5 pt-0">
            {suggestedSettlements.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-foreground text-sm font-bold">All settled up!</p>
                <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
                  No debts currently need to be paid in this group.
                </p>
              </div>
            ) : (
              suggestedSettlements.map((s, idx) => {
                const isMyDebt = s.fromUserId === currentUserId;
                const isOwedToMe = s.toUserId === currentUserId;

                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                      isMyDebt
                        ? "border-amber-500/30 bg-amber-500/5 shadow-2xs"
                        : isOwedToMe
                          ? "border-emerald-500/30 bg-emerald-500/5 shadow-2xs"
                          : "bg-muted/20 border-border/60 hover:border-foreground/20"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
                        <span
                          className={
                            isMyDebt
                              ? "font-bold text-amber-600 underline underline-offset-2 dark:text-amber-400"
                              : ""
                          }
                        >
                          {isMyDebt ? "You" : `@${s.fromUsername}`}
                        </span>
                        <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                        <span
                          className={
                            isOwedToMe
                              ? "font-bold text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
                              : ""
                          }
                        >
                          {isOwedToMe ? "You" : `@${s.toUsername}`}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        Amount:{" "}
                        <strong className="text-foreground text-sm font-black">
                          ₹{s.amount.toFixed(2)}
                        </strong>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isMyDebt ? "default" : "outline"}
                      onClick={() => handleSettleSuggestion(s)}
                      className={`h-8 gap-1 rounded-lg px-3 text-xs font-bold ${
                        isMyDebt ? "bg-amber-600 text-white shadow-xs hover:bg-amber-700" : ""
                      }`}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      <span>Settle</span>
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Settlement History */}
      {settlements.length > 0 && (
        <Card className="border-border/80 bg-card/80 rounded-2xl border shadow-2xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Clock className="text-muted-foreground h-4 w-4" />
              <span>Settlement History</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-5 pt-0">
            {settlements.map((set) => (
              <div
                key={set.id}
                className="bg-muted/20 hover:bg-muted/40 border-border/60 flex items-center justify-between rounded-xl border p-3 text-xs transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-semibold">
                      @{set.payerUsername} paid @{set.recipientUsername}
                    </span>
                    {set.status === "confirmed" && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        Confirmed
                      </Badge>
                    )}
                    {set.status === "pending" && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
                      >
                        Pending
                      </Badge>
                    )}
                    {set.status === "rejected" && (
                      <Badge
                        variant="outline"
                        className="bg-destructive/10 text-destructive border-destructive/30 px-1.5 py-0 text-[10px]"
                      >
                        Rejected
                      </Badge>
                    )}
                    {set.status === "cancelled" && (
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground border-border px-1.5 py-0 text-[10px]"
                      >
                        Cancelled
                      </Badge>
                    )}
                  </div>
                  <div
                    className="text-muted-foreground text-[11px]"
                    title={formatDate(set.settledAt)}
                  >
                    {formatRelativeTime(set.settledAt)}
                  </div>
                </div>

                <span className="text-foreground text-sm font-black">
                  ₹{Number(set.amount).toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
