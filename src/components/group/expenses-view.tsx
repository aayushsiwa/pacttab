"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpenseAction } from "@/actions/expenses";
import { AddExpenseDialog } from "@/components/group/add-expense-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Receipt, Trash2, Calendar, User, Users } from "lucide-react";
import { toast } from "sonner";

interface ExpenseItem {
  id: string;
  description: string;
  amount: string | number;
  paidByUserId: string;
  payerUsername: string;
  expenseDate: Date;
  createdBy: string;
  createdAt: Date;
  splits: {
    id: string;
    userId: string;
    owedAmount: string | number;
    username: string | null;
  }[];
}

interface ExpensesViewProps {
  groupId: string;
  currentUserId: string;
  currentUserRole: string;
  members: { id: string; username: string }[];
  expenses: ExpenseItem[];
}

export function ExpensesView({
  groupId,
  currentUserId,
  currentUserRole,
  members,
  expenses,
}: ExpensesViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const totalSpent = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

  const confirmDelete = () => {
    if (!expenseToDelete) return;

    startTransition(async () => {
      const res = await deleteExpenseAction(groupId, expenseToDelete.id);
      if (res.success) {
        toast.success(`Deleted expense: ${expenseToDelete.description}`);
        setExpenseToDelete(null);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to delete expense");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Total Spent + Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border bg-card p-5 shadow-xs">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Group Spending
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-foreground mt-0.5">
            ₹{totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </p>
        </div>

        <div>
          <AddExpenseDialog
            groupId={groupId}
            currentUserId={currentUserId}
            members={members}
          />
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-10 text-center">
            <Receipt className="h-8 w-8 text-muted-foreground mb-2 opacity-50" />
            <p className="text-sm font-semibold">No expenses recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Keep track of meals, tickets, rents, and shared bills. Add your first expense above.
            </p>
          </div>
        ) : (
          expenses.map((exp) => {
            const canDelete =
              currentUserRole === "admin" ||
              exp.createdBy === currentUserId ||
              exp.paidByUserId === currentUserId;

            const isPayer = exp.paidByUserId === currentUserId;

            return (
              <Card key={exp.id} className="border shadow-xs hover:border-foreground/20 transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-base truncate">{exp.description}</h4>
                      <Badge variant="outline" className="text-[11px] font-mono shrink-0">
                        {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Paid by{" "}
                        <strong className="text-foreground">
                          {isPayer ? "You" : `@${exp.payerUsername}`}
                        </strong>
                      </span>

                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(exp.expenseDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Participant split breakdown preview */}
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-1">
                        <Users className="h-3 w-3" /> Split with:
                      </span>
                      {exp.splits.map((s) => (
                        <span
                          key={s.id}
                          className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          @{s.username || "member"} (₹{Number(s.owedAmount).toFixed(2)})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right side: Amount & Delete button */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div className="text-right">
                      <div className="text-lg font-bold text-foreground">
                        ₹{Number(exp.amount).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ₹{(Number(exp.amount) / exp.splits.length).toFixed(2)} / person
                      </div>
                    </div>

                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setExpenseToDelete(exp)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog for Deleting Expense */}
      <Dialog open={!!expenseToDelete} onOpenChange={(open) => !open && setExpenseToDelete(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{expenseToDelete?.description}&rdquo; (₹
              {Number(expenseToDelete?.amount || 0).toFixed(2)})? This will remove the split debt for all members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpenseToDelete(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
