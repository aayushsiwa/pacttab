export interface GroupDetails {
  group: {
    id: string;
    name: string;
    description: string | null;
    createdBy: string;
    createdAt: string;
  };
  currentUserRole: string;
  members: Array<{
    id: string;
    username: string;
    role: string;
    joinedAt: string;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    amount: string;
    paidByUserId: string;
    payerUsername: string;
    expenseDate: string;
    createdBy: string;
    createdAt: string;
    splits: Array<{
      id: string;
      expenseId: string;
      userId: string;
      owedAmount: string;
      username: string | null;
    }>;
  }>;
  settlements: Array<{
    id: string;
    amount: string;
    paidByUserId: string;
    receivedByUserId: string;
    status: string;
    createdByUserId?: string | null;
    confirmedAt?: string | null;
    rejectedAt?: string | null;
    settledAt: string;
    payerUsername: string;
    recipientUsername: string;
    creatorUsername?: string;
  }>;
  balances: Array<{
    userId: string;
    username: string;
    totalPaid: string;
    totalOwed: string;
    netBalance: string;
  }>;
  suggestedSettlements: Array<{
    fromUserId: string;
    fromUsername: string;
    toUserId: string;
    toUsername: string;
    amount: string;
  }>;
  activeInvites: Array<{
    id: string;
    token: string;
    createdAt: string;
    useCount: number;
    maxUses: number | null;
    expiresAt: string | null;
    requiresApproval: boolean;
  }>;
  pendingJoinRequests: Array<{
    id: string;
    userId: string;
    username: string;
    createdAt: string;
  }>;
}

export interface MessageItem {
  id: string;
  body: string;
  type: string;
  createdAt: string;
  authorId: string | null;
  authorUsername: string | null;
}

export interface PendingRequest {
  id: string;
  groupName: string;
  groupDescription?: string | null;
  username: string;
  createdAt: string;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string | null;
  role: string;
  joinedAt: string;
  createdAt: string;
  memberCount: number;
  lastIncomingMessageAt: string | null;
  pendingJoinRequestsCount?: number;
  pendingSettlementsCount?: number;
  pendingActionCount?: number;
  members?: Array<{ id: string }>;
}
