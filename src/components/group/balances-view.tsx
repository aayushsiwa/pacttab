"use client";

import { useState } from "react";
import { RecordSettlementDialog } from "@/components/group/record-settlement-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowLeftRight, CheckCircle2, User, Clock } from "lucide-react";
import type { MemberBalance, SuggestedSettlement } from "@/lib/balances";

interface SettlementItem {
  id: string;
  amount: string | number;
  paidByUserId: string;
  receivedByUserId: string;
  settledAt: Date;
  payerUsername: string;
  recipientUsername: string;
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

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">Balances & Repayments</h3>
          <p className="text-xs text-muted-foreground">
            Simplified net positions and debt settlement instructions.
          </p>
        </div>

        <Button onClick={handleOpenGeneralDialog} className="gap-1.5 shadow-xs font-medium">
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
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Net Balances</CardTitle>
            <CardDescription className="text-xs">
              Positive means owed money; negative means owes money.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {balances.map((b) => {
              const isOwed = b.netBalance > 0.009;
              const owes = b.netBalance < -0.009;
              const isSettled = !isOwed && !owes;
              const isMe = b.userId === currentUserId;

              return (
                <div
                  key={b.userId}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    isMe ? "bg-muted/40 border-foreground/20" : "bg-card"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-sm">@{b.username}</span>
                      {isMe && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1 font-normal">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Paid ₹{b.totalPaid.toFixed(2)} • Share ₹{b.totalOwed.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right">
                    {isOwed && (
                      <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        +₹{b.netBalance.toFixed(2)}
                      </span>
                    )}
                    {owes && (
                      <span className="font-bold text-sm text-amber-600 dark:text-amber-400">
                        -₹{Math.abs(b.netBalance).toFixed(2)}
                      </span>
                    )}
                    {isSettled && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
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
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Suggested Repayments</CardTitle>
            <CardDescription className="text-xs">
              Minimum transactions needed to settle all debts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestedSettlements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-foreground">All settled up!</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
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
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-foreground/20 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span className={isMyDebt ? "font-bold text-amber-600 dark:text-amber-400" : ""}>
                          {isMyDebt ? "You" : `@${s.fromUsername}`}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={isOwedToMe ? "font-bold text-emerald-600 dark:text-emerald-400" : ""}>
                          {isOwedToMe ? "You" : `@${s.toUsername}`}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Pays <strong className="text-foreground">₹{s.amount.toFixed(2)}</strong>
                      </div>
                    </div>

                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleSettleSuggestion(s)}
                      className="gap-1 text-xs"
                    >
                      <ArrowLeftRight className="h-3 w-3" />
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
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Settlement History</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {settlements.map((set) => (
              <div
                key={set.id}
                className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 text-xs border"
              >
                <div>
                  <span className="font-semibold text-foreground">@{set.payerUsername}</span> paid{" "}
                  <span className="font-semibold text-foreground">@{set.recipientUsername}</span>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(set.settledAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                <span className="font-bold text-sm text-foreground">
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
