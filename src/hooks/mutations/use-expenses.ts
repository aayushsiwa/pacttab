"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

interface CreateExpenseInput {
  groupId: string;
  description: string;
  amount: number;
  paidByUserId: string;
  participantUserIds: string[];
  splitType: "equal" | "exact" | "percentage" | "shares";
  customSplits?: string | null;
  expenseDate?: string;
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create expense");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onMutate: async (newExpense) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.list(newExpense.groupId) });
      const previous = queryClient.getQueryData(queryKeys.expenses.list(newExpense.groupId)) as
        | unknown[]
        | undefined;

      queryClient.setQueryData(
        queryKeys.expenses.list(newExpense.groupId),
        (old: unknown[] | undefined) => [
          {
            id: "temp-" + Date.now(),
            ...newExpense,
            optimistic: true,
            createdAt: new Date().toISOString(),
          },
          ...(old || []),
        ]
      );

      return { previous };
    },
    onError: (err, newExpense, context: { previous?: unknown[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.expenses.list(newExpense.groupId), context.previous);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
    },
  });
}

interface DeleteExpenseInput {
  groupId: string;
  expenseId: string;
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DeleteExpenseInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/expenses/${data.expenseId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete expense");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onMutate: async (expense) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.list(expense.groupId) });
      const previous = queryClient.getQueryData(queryKeys.expenses.list(expense.groupId)) as
        | unknown[]
        | undefined;

      queryClient.setQueryData(
        queryKeys.expenses.list(expense.groupId),
        (old: unknown[] | undefined) =>
          (old || []).filter(
            (e: unknown) => (e as Record<string, unknown>).id !== expense.expenseId
          )
      );

      return { previous };
    },
    onError: (err, expense, context: { previous?: unknown[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.expenses.list(expense.groupId), context.previous);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
    },
  });
}

interface UpdateExpenseInput {
  groupId: string;
  expenseId: string;
  description: string;
  amount: number;
  paidByUserId: string;
  participantUserIds: string[];
  splitType: "equal" | "exact" | "percentage" | "shares";
  customSplits?: string | null;
  expenseDate?: string;
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateExpenseInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/expenses/${data.expenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update expense");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onMutate: async (updated) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.list(updated.groupId) });
      const previous = queryClient.getQueryData(queryKeys.expenses.list(updated.groupId)) as
        | unknown[]
        | undefined;

      queryClient.setQueryData(
        queryKeys.expenses.list(updated.groupId),
        (old: unknown[] | undefined) =>
          (old || []).map((e: unknown) =>
            (e as Record<string, unknown>).id === updated.expenseId
              ? {
                  ...(e as Record<string, unknown>),
                  ...updated,
                  updatedAt: new Date().toISOString(),
                  optimistic: true,
                }
              : e
          )
      );

      return { previous };
    },
    onError: (err, updated, context: { previous?: unknown[] } | undefined) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.expenses.list(updated.groupId), context.previous);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(variables.groupId) });
    },
  });
}

interface RecordSettlementInput {
  groupId: string;
  paidByUserId: string;
  receivedByUserId: string;
  amount: number;
}

export function useRecordSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RecordSettlementInput) => {
      const res = await fetch(`/api/groups/${data.groupId}/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record settlement");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      toast.success("Settlement recorded");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface ConfirmSettlementInput {
  groupId: string;
  settlementId: string;
}

export function useConfirmSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ConfirmSettlementInput) => {
      const res = await fetch(
        `/api/groups/${data.groupId}/settlements/${data.settlementId}/confirm`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to confirm settlement");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      toast.success("Settlement confirmed");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface RejectSettlementInput {
  groupId: string;
  settlementId: string;
}

export function useRejectSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: RejectSettlementInput) => {
      const res = await fetch(
        `/api/groups/${data.groupId}/settlements/${data.settlementId}/reject`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to reject settlement");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      toast.success("Settlement rejected");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface CancelSettlementInput {
  groupId: string;
  settlementId: string;
}

export function useCancelSettlement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CancelSettlementInput) => {
      const res = await fetch(
        `/api/groups/${data.groupId}/settlements/${data.settlementId}/cancel`,
        {
          method: "POST",
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to cancel settlement");
      }
      return res.json() as Promise<{ success: boolean; error?: string }>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.list(variables.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(variables.groupId) });
      toast.success("Settlement cancelled");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
