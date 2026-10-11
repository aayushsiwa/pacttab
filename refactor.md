# TanStack Query Migration Plan

## Current Architecture Problems

- Server-centric: `revalidatePath()` + `router.refresh()` re-fetches entire page
- No optimistic updates - UI blocked on server round-trip
- No client-side cache deduplication
- Race conditions between WS events and server action cache invalidation
- WebSocket handlers manually call `router.refresh()` for specific event types

## Target Architecture

- **TanStack Query v5** for all client-side data fetching
- **Server Actions** become Query mutations with `onMutate`/`onError`/`onSettled` for optimistic updates
- **WebSocket events** directly invalidate/update query cache via `queryClient.invalidateQueries()` or `queryClient.setQueryData()`
- Remove all `router.refresh()` and `revalidatePath()` calls

---

## Phase 1: Setup & Provider (Week 1)

### 1.1 Install Dependencies

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install -D @tanstack/eslint-plugin-query
```

### 1.2 Create Query Provider

**File:** `src/providers/query-provider.tsx`

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 min
            gcTime: 1000 * 60 * 30, // 30 min
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### 1.3 Wrap App Layout

**File:** `src/app/providers.tsx` (new)

```tsx
"use client";
import { QueryProvider } from "@/providers/query-provider";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryProvider>
  );
}
```

**File:** `src/app/layout.tsx` - wrap `<body>` with `<Providers>`

---

## Phase 2: Define Query Keys & Hooks (Week 1-2)

### 2.1 Centralized Query Keys

**File:** `src/lib/query-keys.ts`

```ts
export const queryKeys = {
  groups: {
    all: ["groups"] as const,
    lists: () => [...queryKeys.groups.all, "list"] as const,
    list: (filters: string) => [...queryKeys.groups.lists(), { filters }] as const,
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
    pendingAdminActions: ["user", "pendingAdminActions"] as const,
  },
} as const;
```

### 2.2 Create Query Hooks (migrate from `src/lib/queries.ts`)

**File:** `src/hooks/queries/use-groups.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups.lists(),
    queryFn: async () => {
      const res = await fetch("/api/groups");
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });
}

export function useGroupDetail(groupId: string) {
  return useQuery({
    queryKey: queryKeys.groups.detail(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: !!groupId,
  });
}
```

**File:** `src/hooks/queries/use-expenses.ts`

```ts
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useExpenses(groupId: string) {
  return useQuery({
    queryKey: queryKeys.expenses.list(groupId),
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/expenses`);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    enabled: !!groupId,
  });
}
```

Similar hooks for: `useSettlements`, `useBalances`, `useMessages`, `useMembers`, `useUserPendingJoinRequests`, `useUserPendingAdminActions`

---

## Phase 3: Create API Routes for Client Fetching (Week 2)

Replace server-only `getGroupDetails()` with REST endpoints:

| Current                             | New API Route                       |
| ----------------------------------- | ----------------------------------- |
| `getGroupDetails()`                 | `GET /api/groups/[id]`              |
| `getGroupMessages()`                | `GET /api/groups/[id]/messages`     |
| `getUserGroups()`                   | `GET /api/groups`                   |
| `getUserPendingJoinRequests()`      | `GET /api/user/join-requests`       |
| `getUserPendingAdminActionsCount()` | `GET /api/user/admin-actions-count` |

Each route returns typed JSON (reuse logic from `src/lib/queries.ts`).

---

## Phase 4: Convert Server Actions to Mutations (Week 2-3)

### Pattern for Each Mutation

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

export function useCreateExpense(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      const res = await fetch(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create expense");
      return res.json();
    },
    onMutate: async (newExpense) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.expenses.list(groupId) });
      const previous = queryClient.getQueryData(queryKeys.expenses.list(groupId));

      queryClient.setQueryData(queryKeys.expenses.list(groupId), (old: Expense[]) => [
        { ...newExpense, id: "temp-" + Date.now(), optimistic: true },
        ...(old || []),
      ]);

      return { previous };
    },
    onError: (err, newExpense, context) => {
      queryClient.setQueryData(queryKeys.expenses.list(groupId), context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
    },
  });
}
```

### Mutations to Convert

| Server Action             | Mutation Hook          |
| ------------------------- | ---------------------- |
| `createGroupAction`       | `useCreateGroup`       |
| `createInviteLinkAction`  | `useCreateInviteLink`  |
| `rotateInviteLinkAction`  | `useRotateInviteLink`  |
| `revokeInviteLinkAction`  | `useRevokeInviteLink`  |
| `joinGroupAction`         | `useJoinGroup`         |
| `createJoinRequestAction` | `useCreateJoinRequest` |
| `reviewJoinRequestAction` | `useReviewJoinRequest` |
| `updateGroupAction`       | `useUpdateGroup`       |
| `transferAdminAction`     | `useTransferAdmin`     |
| `leaveGroupAction`        | `useLeaveGroup`        |
| `deleteGroupAction`       | `useDeleteGroup`       |
| `createExpenseAction`     | `useCreateExpense`     |
| `deleteExpenseAction`     | `useDeleteExpense`     |
| `updateExpenseAction`     | `useUpdateExpense`     |
| `recordSettlementAction`  | `useRecordSettlement`  |
| `confirmSettlementAction` | `useConfirmSettlement` |
| `rejectSettlementAction`  | `useRejectSettlement`  |
| `cancelSettlementAction`  | `useCancelSettlement`  |
| `sendMessageAction`       | `useSendMessage`       |

---

## Phase 5: WebSocket Integration with Query Cache (Week 3)

### 5.1 Enhanced useGroupSocket

**File:** `src/hooks/use-group-socket.ts`

```tsx
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const queryClient = useQueryClient(); // Need to access differently - see below

  switch (data.type) {
    case "new_message":
      queryClient.setQueryData(queryKeys.messages.list(data.groupId), (old: Message[]) => [
        ...(old || []),
        data.message,
      ]);
      break;
    case "expense_created":
    case "expense_updated":
    case "expense_deleted":
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.list(data.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(data.groupId) });
      break;
    case "settlement_recorded":
    case "settlement_confirmed":
    case "settlement_rejected":
    case "settlement_cancelled":
      queryClient.invalidateQueries({ queryKey: queryKeys.settlements.list(data.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.balances.detail(data.groupId) });
      break;
    case "member_joined":
      queryClient.invalidateQueries({ queryKey: queryKeys.members.list(data.groupId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(data.groupId) });
      break;
    case "join_request_created":
    case "join_request_reviewed":
      queryClient.invalidateQueries({
        queryKey: queryKeys.groups.pendingJoinRequests(data.groupId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.user.pendingAdminActions });
      break;
    case "refresh":
      queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(data.groupId) });
      break;
  }
};
```

**Note:** Since `useQueryClient` can't be used in `useEffect`, create a singleton accessor or pass queryClient via context.

### 5.2 Provide QueryClient to Socket Hook

**Option A:** Store queryClient in global (simple)

```ts
// src/lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";
export const queryClient = new QueryClient({...});
```

**Option B:** Context provider (cleaner)

```tsx
// src/providers/query-client-provider.tsx
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext } from "react";

const QueryClientContext = createContext<ReturnType<typeof useQueryClient> | null>(null);

export function useQueryClientContext() {
  const client = useContext(QueryClientContext);
  if (!client) throw new Error("useQueryClientContext must be used within QueryClientProvider");
  return client;
}
```

Then in `use-group-socket.ts`:

```ts
import { useQueryClientContext } from "@/providers/query-client-provider";

export function useGroupSocket({...}) {
  const queryClient = useQueryClientContext();
  // ... use queryClient in ws.onmessage
}
```

---

## Phase 6: Update Components to Use Hooks (Week 3-4)

### 6.1 Group Page - Convert to Client Component

**File:** `src/app/group/[id]/page.tsx`

```tsx
"use client";
import { useGroupDetail } from "@/hooks/queries/use-groups";
import { useExpenses } from "@/hooks/queries/use-expenses";
// ... other hooks

export default function GroupPage({ params }: GroupPageProps) {
  const { id: groupId } = await params;
  const { data: groupDetail } = useGroupDetail(groupId);
  const { data: expenses } = useExpenses(groupId);
  // ... other queries

  if (!groupDetail) return <Loading />;

  return <GroupTabs ... />;
}
```

### 6.2 Groups Page

**File:** `src/app/groups/page.tsx`

```tsx
"use client";
import { useGroups } from "@/hooks/queries/use-groups";
import { useUserPendingJoinRequests } from "@/hooks/queries/use-user";

export default function GroupsPage() {
  const { data: groups } = useGroups();
  const { data: pendingRequests } = useUserPendingJoinRequests();
  // ...
}
```

### 6.3 Component Updates

- Replace `router.refresh()` calls with query invalidation in mutation `onSettled`
- Replace `useTransition` + Server Actions with `useMutation`
- Pass mutation functions to dialogs/components via props or context

---

## Phase 7: Remove Legacy Code (Week 4)

### 7.1 Remove from Server Actions

- All `revalidatePath()` calls
- All `redirect()` calls (handle navigation in mutation `onSuccess`)

### 7.2 Remove from Components

- All `router.refresh()` calls
- `useTransition` for server actions

### 7.3 Remove WebSocket `router.refresh()` handlers

- `use-group-socket.ts` lines 99-121

### 7.4 Delete Unused

- `src/lib/queries.ts` (replaced by API routes + hooks)
- `getGroupMessages` action (replaced by API route)

---

## Phase 8: Advanced Optimizations (Week 4+)

### 8.1 Prefetching

```tsx
// In link hover or on page load
const queryClient = useQueryClient();
queryClient.prefetchQuery({ queryKey: queryKeys.groups.detail(groupId) });
```

### 8.2 Infinite Queries for Messages

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

export function useMessages(groupId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages.list(groupId),
    queryFn: ({ pageParam }) => fetch(`/api/groups/${groupId}/messages?cursor=${pageParam}`),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
  });
}
```

### 8.3 Persist Cache (optional)

```bash
npm install @tanstack/query-sync-storage-persister
```

---

## Migration Checklist

- [ ] Install TanStack Query dependencies
- [ ] Create QueryProvider and wrap app
- [ ] Define queryKeys.ts
- [ ] Create API routes for all queries
- [ ] Create query hooks (useGroups, useExpenses, etc.)
- [ ] Create mutation hooks for all server actions
- [ ] Update WebSocket handler to use queryClient
- [ ] Convert group page to client component with hooks
- [ ] Convert groups page to client component with hooks
- [ ] Convert all dialogs/components to use mutations
- [ ] Remove all `revalidatePath()` from server actions
- [ ] Remove all `router.refresh()` from components
- [ ] Remove `useTransition` from server action calls
- [ ] Delete `src/lib/queries.ts`
- [ ] Add ESLint plugin for TanStack Query
- [ ] Test optimistic updates work correctly
- [ ] Verify WebSocket events update cache in real-time

---

## Rollback Plan

If issues arise:

1. Keep `revalidatePath()` in server actions as fallback
2. Use `queryClient.invalidateQueries()` in `onSettled` as safety net
3. Feature flag via env var to toggle TanStack Query on/off per route
