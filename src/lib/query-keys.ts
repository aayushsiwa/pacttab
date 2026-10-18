export const queryKeys = {
  groups: {
    all: ["groups"] as const,
    lists: () => [...queryKeys.groups.all, "list"] as const,
    list: (filters?: string) => [...queryKeys.groups.lists(), { filters }] as const,
    details: () => [...queryKeys.groups.all, "detail"] as const,
    detail: (groupId: string) => [...queryKeys.groups.details(), groupId] as const,
    pendingInvites: (groupId: string) => [...queryKeys.groups.detail(groupId), "invites"] as const,
    pendingJoinRequests: (groupId: string) =>
      [...queryKeys.groups.detail(groupId), "joinRequests"] as const,
  },
  expenses: {
    all: ["expenses"] as const,
    list: (groupId: string) => [...queryKeys.expenses.all, groupId] as const,
  },
  settlements: {
    all: ["settlements"] as const,
    list: (groupId: string) => [...queryKeys.settlements.all, groupId] as const,
  },
  balances: {
    all: ["balances"] as const,
    detail: (groupId: string) => [...queryKeys.balances.all, groupId] as const,
  },
  messages: {
    all: ["messages"] as const,
    list: (groupId: string) => [...queryKeys.messages.all, groupId] as const,
  },
  members: {
    all: ["members"] as const,
    list: (groupId: string) => [...queryKeys.members.all, groupId] as const,
  },
  user: {
    pendingJoinRequests: ["user", "pendingJoinRequests"] as const,
    pendingDirectInvites: ["user", "pendingDirectInvites"] as const,
    pendingAdminActions: ["user", "pendingAdminActions"] as const,
  },
} as const;
