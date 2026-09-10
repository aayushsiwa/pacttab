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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-emerald-500/5 p-6 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Group Spending
            </span>
            <span className="rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.2 border border-emerald-500/20">
              Active Tab
            </span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            ₹{totalSpent.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">
            Cumulative across {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {expenses.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1.5 text-xs font-semibold rounded-xl h-10 px-3.5 border-border/80 shadow-2xs hover:bg-muted/80 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Export CSV</span>
            </Button>
          )}

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
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center shadow-2xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/70 text-muted-foreground mb-3 ring-1 ring-border shadow-2xs">
              <Receipt className="h-7 w-7 opacity-60" />
            </div>
            <p className="text-base font-bold text-foreground">No expenses recorded yet</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm leading-relaxed">
              Keep track of meals, tickets, rents, and shared bills. Tap &ldquo;Add Expense&rdquo; above to split your first bill.
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
              <Card key={exp.id} className="border border-border/80 bg-card/80 shadow-2xs hover:border-emerald-500/30 hover:shadow-sm transition-all rounded-2xl overflow-hidden">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs ring-1 ring-emerald-500/20 mt-0.5">
                      <Receipt className="h-5 w-5" />
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-base text-foreground truncate">{exp.description}</h4>
                        <Badge variant="outline" className="text-[10px] font-semibold tracking-wider rounded-full px-2 py-0">
                          {exp.splits.length} {exp.splits.length === 1 ? "person" : "people"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            Paid by{" "}
                            {isPayer ? (
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-md border border-emerald-500/20">
                                You
                              </span>
                            ) : (
                              <strong className="text-foreground">@{exp.payerUsername}</strong>
                            )}
                          </span>
                        </span>

                        <span className="flex items-center gap-1.5" title={formatDate(exp.expenseDate)}>
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>
                            {formatRelativeTime(exp.createdAt)}
                          </span>
                        </span>
                      </div>

                      {/* Participant split breakdown preview */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mr-0.5">
                          <Users className="h-3 w-3" /> Split with:
                        </span>
                        {exp.splits.map((s) => (
                          <span
                            key={s.id}
                            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-medium border ${
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
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-border/60">
                    <div className="text-left sm:text-right">
                      <div className="text-xl font-black text-foreground tracking-tight">
                        ₹{Number(exp.amount).toFixed(2)}
                      </div>
                      <div className="text-[11px] font-medium text-muted-foreground">
                        ₹{(Number(exp.amount) / exp.splits.length).toFixed(2)} / person
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg h-7 w-7"
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
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg h-7 w-7"
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
