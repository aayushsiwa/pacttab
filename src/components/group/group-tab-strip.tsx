"use client";

import { MessageSquare, Receipt, ArrowLeftRight } from "lucide-react";
import { cn } from "cn";

export type GroupTab = "chat" | "expenses" | "balances";

interface GroupTabStripProps {
  activeTab: GroupTab;
  onTabChange: (tab: GroupTab) => void;
  expenseCount: number;
  chatUnreadCount?: number;
  pendingSettlementCount?: number;
}

export function GroupTabStrip({
  activeTab,
  onTabChange,
  expenseCount,
  chatUnreadCount = 0,
  pendingSettlementCount = 0,
}: GroupTabStripProps) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div
        role="tablist"
        aria-label="Group tabs"
        className="bg-muted/50 border-border/80 flex h-12 min-w-max items-center justify-start gap-1 rounded-2xl border p-1.5 shadow-2xs sm:w-full sm:gap-1.5"
      >
        {/* Chat Tab */}
        <button
          type="button"
          role="tab"
          id="tab-chat"
          aria-controls="tabpanel-chat"
          aria-selected={activeTab === "chat"}
          onClick={() => onTabChange("chat")}
          className={cn(
            "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all select-none sm:gap-2 sm:px-4",
            activeTab === "chat"
              ? "bg-card text-foreground border-border/60 border shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Chat</span>
          <span className="hidden sm:inline">& Activity</span>
          {chatUnreadCount > 0 && activeTab !== "chat" && (
            <span className="relative ml-0.5 flex h-2 w-2" title={`${chatUnreadCount} unread`}>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
        </button>

        {/* Expenses Tab */}
        <button
          type="button"
          role="tab"
          id="tab-expenses"
          aria-controls="tabpanel-expenses"
          aria-selected={activeTab === "expenses"}
          onClick={() => onTabChange("expenses")}
          className={cn(
            "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all select-none sm:gap-2 sm:px-4",
            activeTab === "expenses"
              ? "bg-card text-foreground border-border/60 border shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <Receipt className="h-3.5 w-3.5" />
          <span>Expenses</span>
          <span className="bg-muted-foreground/15 py-0.2 rounded-full px-1.5 text-[10px] font-bold">
            {expenseCount}
          </span>
        </button>

        {/* Balances Tab */}
        <button
          type="button"
          role="tab"
          id="tab-balances"
          aria-controls="tabpanel-balances"
          aria-selected={activeTab === "balances"}
          onClick={() => onTabChange("balances")}
          className={cn(
            "relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-bold transition-all select-none sm:gap-2 sm:px-4",
            activeTab === "balances"
              ? "bg-card text-foreground border-border/60 border shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-card/40"
          )}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Balances</span>
          {pendingSettlementCount > 0 && activeTab !== "balances" && (
            <span
              className="relative ml-0.5 flex h-2 w-2"
              title={`${pendingSettlementCount} settlement(s) awaiting your affirmation`}
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
