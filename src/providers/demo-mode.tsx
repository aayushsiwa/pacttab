"use client";

import { createContext, useContext, type ReactNode } from "react";
import type {
  CreateExpenseInput,
  UpdateExpenseInput,
  DeleteExpenseInput,
  RecordSettlementInput,
  ConfirmSettlementInput,
  RejectSettlementInput,
  CancelSettlementInput,
} from "@/hooks/mutations/use-expenses";
import type { SendMessageInput } from "@/hooks/mutations/use-chat";

export interface DemoActions {
  sendMessage: (data: SendMessageInput) => void;
  createExpense: (data: CreateExpenseInput) => void;
  updateExpense: (data: UpdateExpenseInput) => void;
  deleteExpense: (data: DeleteExpenseInput) => void;
  recordSettlement: (data: RecordSettlementInput) => void;
  confirmSettlement: (data: ConfirmSettlementInput) => void;
  rejectSettlement: (data: RejectSettlementInput) => void;
  cancelSettlement: (data: CancelSettlementInput) => void;
}

const DemoActionsContext = createContext<DemoActions | null>(null);

export function DemoModeProvider({
  actions,
  children,
}: {
  actions: DemoActions;
  children: ReactNode;
}) {
  return <DemoActionsContext.Provider value={actions}>{children}</DemoActionsContext.Provider>;
}

/** Demo actions when mounted inside a DemoModeProvider, null in the real app. */
export function useDemoActions(): DemoActions | null {
  return useContext(DemoActionsContext);
}
