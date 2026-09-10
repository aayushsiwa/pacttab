"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpenseAction } from "@/actions/expenses";
import { AddExpenseDialog } from "@/components/group/add-expense-dialog";
import { EditExpenseDialog } from "@/components/group/edit-expense-dialog";
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
import { Receipt, Trash2, Calendar, User, Users, Edit3, Download } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, formatDate } from "@/lib/date";
import { exportExpensesToCsv } from "@/lib/export-csv";

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
  groupName?: string;
  currentUserId: string;
  currentUserRole: string;
  members: { id: string; username: string }[];
  expenses: ExpenseItem[];
}

export function ExpensesView({
  groupId,
  groupName = "Group",
  currentUserId,
  currentUserRole,
  members,
  expenses,
}: ExpensesViewProps) {
  const [expenseToDelete, setExpenseToDelete] = useState<ExpenseItem | null>(null);
  const [expenseToEdit, setExpenseToEdit] = useState<ExpenseItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const totalSpent = expenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

  const handleExportCsv = () => {
    try {
      exportExpensesToCsv(groupName, expenses);
      toast.success("Expenses exported to CSV!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to export expenses");
    }
  };

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
      <div className="border-border/80 from-card via-card flex flex-col gap-5 rounded-2xl border bg-gradient-to-br to-emerald-500/5 p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-[11px] font-bold tracking-wider uppercase">
              Total Group Spending
            </span>
            <span className="py-0.2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              Active Tab
            </span>
          </div>
          <div className="text-foreground text-3xl font-black tracking-tight sm:text-4xl">
            ₹
            {totalSpent.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Cumulative across {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {expenses.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="border-border/80 hover:bg-muted/80 h-10 cursor-pointer gap-1.5 rounded-xl px-3.5 text-xs font-semibold shadow-2xs"
            >
              <Download className="text-muted-foreground h-3.5 w-3.5" />
              <span>Export CSV</span>
            </Button>
          )}

          <AddExpenseDialog groupId={groupId} currentUserId={currentUserId} members={members} />
        </div>
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="border-border/80 bg-card/40 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center shadow-2xs">
            <div className="bg-muted/70 text-muted-foreground ring-border mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-2xs ring-1">
              <Receipt className="h-7 w-7 opacity-60" />
            </div>
            <p className="text-foreground text-base font-bold">No expenses recorded yet</p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed sm:text-sm">
              Keep track of meals, tickets, rents, and shared bills. Tap &ldquo;Add Expense&rdquo;
              above to split your first bill.
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
              <Card
                key={exp.id}
                className="border-border/80 bg-card/80 overflow-hidden rounded-2xl border shadow-2xs transition-all hover:border-emerald-500/30 hover:shadow-sm"
              >
                <CardContent className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600 shadow-2xs ring-1 ring-emerald-500/20 dark:text-emerald-400">
                      <Receipt className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-foreground truncate text-base font-bold">
                          {exp.description}
                        </h4>
                        <Badge
                          variant="outline"
                          className="rounded-full px-2 py-0 text-[10px] font-semibold tracking-wider"
                        >
                          {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"}
                        </Badge>
                      </div>

                      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span className="flex items-center gap-1.5">
                          <User className="text-muted-foreground h-3.5 w-3.5" />
                          <span>
                            Paid by{" "}
                            {isPayer ? (
                              <span className="py-0.2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                                You
                              </span>
                            ) : (
                              <strong className="text-foreground">@{exp.payerUsername}</strong>
                            )}
                          </span>
                        </span>

                        <span
                          className="flex items-center gap-1.5"
                          title={formatDate(exp.expenseDate)}
                        >
                          <Calendar className="text-muted-foreground h-3.5 w-3.5" />
                          <span>{formatRelativeTime(exp.createdAt)}</span>
                        </span>
                      </div>

                      {/* Participant split breakdown preview */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-muted-foreground mr-0.5 flex items-center gap-1 text-[11px] font-medium">
                          <Users className="h-3 w-3" /> Split with:
                        </span>
                        {exp.splits.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-medium ${
                              s.userId === currentUserId
                                ? "bg-primary/10 text-primary border-primary/20 font-bold"
                                : "bg-muted/60 text-muted-foreground border-border/50"
                            }`}
                          >
                            @{s.username || "member"} (₹{Number(s.owedAmount).toFixed(2)})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right side: Amount & Delete button */}
                  <div className="border-border/60 flex shrink-0 items-center justify-between gap-2 border-t pt-3 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="text-foreground text-xl font-black tracking-tight">
                        ₹{Number(exp.amount).toFixed(2)}
                      </div>
                      <div className="text-muted-foreground text-[11px] font-medium">
                        ₹{(Number(exp.amount) / exp.splits.length).toFixed(2)} / person
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-7 w-7 rounded-lg"
                          onClick={() => setExpenseToEdit(exp)}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 rounded-lg"
                          onClick={() => setExpenseToDelete(exp)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      )}
                    </div>
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
              {Number(expenseToDelete?.amount || 0).toFixed(2)})? This will remove the split debt
              for all members.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2 sm:gap-0">
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

      {/* Edit Expense Dialog */}
      <EditExpenseDialog
        groupId={groupId}
        currentUserId={currentUserId}
        members={members}
        expense={expenseToEdit}
        open={!!expenseToEdit}
        onOpenChange={(open) => !open && setExpenseToEdit(null)}
      />
    </div>
  );
}
