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
import { ArrowRight, ArrowLeftRight, CheckCircle2, Clock, Check, X, AlertCircle, Loader2 } from "lucide-react";
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
  const [activePrefill, setActivePrefill] = useState<{
    payerId?: string;
    recipientId?: string;
    amount?: number;
  } | undefined>(undefined);
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
        <Card className="border border-amber-500/30 bg-amber-500/5 shadow-2xs rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-900 dark:text-amber-300">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <span>Pending Settlements ({pendingSettlements.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-amber-800/80 dark:text-amber-300/70">
              Settlements require confirmation from the other member before net balances update.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-500/20 bg-background/80"
                >
                  <div className="space-y-1">
                    <div className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                      {isAwaitingMyConfirmation ? (
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                          Action Required: Affirm payment
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending Confirmation</span>
                      )}
                    </div>
                    <div className="text-xs text-foreground font-medium">
                      @{set.payerUsername} ➔ @{set.recipientUsername}:{" "}
                      <strong className="font-bold text-sm">₹{Number(set.amount).toFixed(2)}</strong>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {isAwaitingMyConfirmation
                        ? `Recorded by @${set.creatorUsername || set.payerUsername}. Please confirm if you sent/received this.`
                        : isMyPendingSubmission
                        ? `Waiting for @${counterpartyUsername} to affirm.`
                        : `Recorded by @${set.creatorUsername || set.payerUsername}. Waiting for @${counterpartyUsername}.`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isAwaitingMyConfirmation && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleConfirm(set.id)}
                          disabled={isWorking}
                          className="h-8 px-3 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                        >
                          {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          <span>Confirm</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(set.id)}
                          disabled={isWorking}
                          className="h-8 px-3 text-xs font-semibold gap-1 text-destructive hover:bg-destructive/10 border-destructive/30 rounded-lg"
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
                        className="h-8 px-3 text-xs font-semibold gap-1 text-muted-foreground hover:text-foreground rounded-lg"
                      >
                        {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
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
      <div className={`p-5 rounded-2xl border shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        myNet > 0.009
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
          : myNet < -0.009
          ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
          : "bg-muted/40 border-border/80 text-foreground"
      }`}>
        <div className="flex items-center gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-lg shadow-2xs ${
            myNet > 0.009
              ? "bg-emerald-500 text-white"
              : myNet < -0.009
              ? "bg-amber-500 text-white"
              : "bg-muted text-muted-foreground"
          }`}>
            {myNet > 0.009 ? "+" : myNet < -0.009 ? "-" : "✓"}
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">
              Your Net Position
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight">
              {myNet > 0.009
                ? `You are owed ₹${myNet.toFixed(2)}`
                : myNet < -0.009
                ? `You owe ₹${Math.abs(myNet).toFixed(2)}`
                : "You are all settled up! 🎉"}
            </div>
            <p className="text-xs opacity-75 mt-0.5">
              {myNet > 0.009
                ? "Other members will repay you based on the suggested transfers below."
                : myNet < -0.009
                ? "Pay your share using UPI or cash, then record it to balance the sheet."
                : "You have no outstanding debts or receivables in this group."}
            </p>
          </div>
        </div>

        <Button onClick={handleOpenGeneralDialog} className="gap-2 shadow-xs font-bold shrink-0 self-start sm:self-center h-10 px-4 rounded-xl">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Member Net Balances */}
        <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold">Net Balances</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Positive means owed money; negative means owes money to group.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5">
            {balances.map((b) => {
              const isOwed = b.netBalance > 0.009;
              const owes = b.netBalance < -0.009;
              const isSettled = !isOwed && !owes;
              const isMe = b.userId === currentUserId;

              return (
                <div
                  key={b.userId}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isMe
                      ? "bg-primary/5 border-primary/25 shadow-2xs"
                      : "bg-muted/20 border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar username={b.username} size="default" />
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-xs sm:text-sm truncate">
                        <span>@{b.username}</span>
                        {isMe && (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                            You
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Paid ₹{b.totalPaid.toFixed(2)} • Share ₹{b.totalOwed.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {isOwed && (
                      <span className="inline-flex items-center font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        +₹{b.netBalance.toFixed(2)}
                      </span>
                    )}
                    {owes && (
                      <span className="inline-flex items-center font-black text-xs sm:text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        -₹{Math.abs(b.netBalance).toFixed(2)}
                      </span>
                    )}
                    {isSettled && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-lg">
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
        <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold">Suggested Repayments</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              Minimum transfers computed to settle all debts with zero leftovers.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5">
            {suggestedSettlements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 mb-2.5">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-foreground">All settled up!</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
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
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                      isMyDebt
                        ? "bg-amber-500/5 border-amber-500/30 shadow-2xs"
                        : isOwedToMe
                        ? "bg-emerald-500/5 border-emerald-500/30 shadow-2xs"
                        : "bg-muted/20 border-border/60 hover:border-foreground/20"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                        <span className={isMyDebt ? "font-bold text-amber-600 dark:text-amber-400 underline underline-offset-2" : ""}>
                          {isMyDebt ? "You" : `@${s.fromUsername}`}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className={isOwedToMe ? "font-bold text-emerald-600 dark:text-emerald-400 underline underline-offset-2" : ""}>
                          {isOwedToMe ? "You" : `@${s.toUsername}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Amount: <strong className="text-foreground font-black text-sm">₹{s.amount.toFixed(2)}</strong>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant={isMyDebt ? "default" : "outline"}
                      onClick={() => handleSettleSuggestion(s)}
                      className={`gap-1 text-xs font-bold h-8 px-3 rounded-lg ${
                        isMyDebt ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs" : ""
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
        <Card className="border border-border/80 bg-card/80 shadow-2xs rounded-2xl">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Settlement History</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2">
            {settlements.map((set) => (
              <div
                key={set.id}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors text-xs border border-border/60"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      @{set.payerUsername} paid @{set.recipientUsername}
                    </span>
                    {set.status === "confirmed" && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5">
                        Confirmed
                      </Badge>
                    )}
                    {set.status === "pending" && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] py-0 px-1.5">
                        Pending
                      </Badge>
                    )}
                    {set.status === "rejected" && (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] py-0 px-1.5">
                        Rejected
                      </Badge>
                    )}
                    {set.status === "cancelled" && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-border text-[10px] py-0 px-1.5">
                        Cancelled
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground" title={formatDate(set.settledAt)}>
                    {formatRelativeTime(set.settledAt)}
                  </div>
                </div>

                <span className="font-black text-sm text-foreground">
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
