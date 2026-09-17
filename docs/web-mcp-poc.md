# Proof of Concept (POC): Web MCP Implementation for PactTab

## 1. Executive Summary

This document outlines the architecture, design, and proof-of-concept (POC) plan for introducing **Web Model Context Protocol (Web MCP)** support into **PactTab**.

The **Model Context Protocol (MCP)** is an open standard created by Anthropic that provides a unified protocol for AI applications (e.g., Claude Desktop, Cursor, browser-native AI agents, or an embedded in-app assistant) to safely discover resources, invoke tools, and access context from external services.

By implementing Web MCP, PactTab will enable:

1. **External AI Agents**: Allowing desktop/browser AI tools (Claude, Cursor, sidecars) to query balances, log expenses, and draft settlements via a secure, authenticated remote MCP endpoint.
2. **In-App Conversational Assistant**: Enabling an embedded AI assistant inside PactTab that turns conversational chat into structured financial actions (e.g., _"Maya paid ₹1,800 for seafood, split ₹1,000 for Arjun and ₹800 for me"_).
3. **Zero-Knowledge Privacy Preservation**: Maintaining PactTab's foundational privacy rule—no PII (emails, phone numbers, or address books) is ever exposed or collected by the MCP server.

---

## 2. Core Use Cases

### Use Case A: Natural Language Expense Logging

- **User Input**: _"I paid ₹1,450 for groceries at SuperMart yesterday. Split equally between me, Maya, and Arjun."_
- **Agent Flow**:
  1. Resolves `current_user` and active group members (`Maya`, `Arjun`).
  2. Calculates per-person share (`₹483.34`, `₹483.33`, `₹483.33`).
  3. Calls tool `create_expense` with verified splits.
  4. Returns structured confirmation and updates group balances in real time via WebSockets.

### Use Case B: Conversational Balance & Debt Inquiries

- **User Input**: _"Who owes me money in the Goa Trip group, and what's the simplest way for us to settle up?"_
- **Agent Flow**:
  1. Invokes tool `get_group_balances` for the specified group.
  2. Evaluates the simplified debt graph.
  3. Responds: _"Maya owes you ₹600.00 from Beach Shack Seafood. Arjun is settled up. Would you like me to record a settlement request for Maya?"_

### Use Case C: Smart Settlement Affirmations

- **User Input**: _"Record that Arjun paid me ₹600 via UPI."_
- **Agent Flow**:
  1. Invokes tool `record_settlement` with `payerId: Arjun`, `recipientId: currentUser`, `amount: 600`.
  2. Status set to `confirmed` or `pending` (triggering a settlement affirmation request to Arjun).
  3. Broadcasts activity message to group chat.

### Use Case D: Admin Group Operations

- **User Input**: _"Create a 7-day invite link for the flatmates group capped at 4 people that requires my approval."_
- **Agent Flow**:
  1. Verifies caller is group admin via `get_group_details`.
  2. Invokes `create_invite_link` with `expiresInDays: 7`, `maxUses: 4`, `requiresApproval: true`.
  3. Returns shareable URL: `https://pacttab.app/join/<token>`.

---

## 3. Architecture & Protocols

```
┌────────────────────────────────────────────────────────┐
│                   AI Clients                           │
│  ┌──────────────────┐            ┌──────────────────┐  │
│  │  External Agents │            │ In-App Assistant │  │
│  │ (Claude, Cursor) │            │ (Web Component)  │  │
│  └────────┬─────────┘            └────────┬─────────┘  │
└───────────┼───────────────────────────────┼────────────┘
            │                               │
            │ HTTP / SSE Transport          │ In-Process / Action
            ▼                               ▼
┌────────────────────────────────────────────────────────┐
│               PactTab Next.js 16 Server                │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ /api/mcp/sse      (SSE Event Stream)             │  │
│  │ /api/mcp/messages (JSON-RPC 2.0 Command Post)    │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │ Scoped Session / API Token │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │           PactTab MCP Server Router              │  │
│  │   - Auth & Role Guards                           │  │
│  │   - Zero-Data Privacy Filter                     │  │
│  │   - JSON-RPC Dispatcher                          │  │
│  └──────────┬──────────────────────────┬────────────┘  │
│             │                          │               │
│             ▼                          ▼               │
│     ┌───────────────┐          ┌───────────────┐       │
│     │  MCP Tools    │          │ MCP Resources │       │
│     │ (Mutations)   │          │ (Read/State)  │       │
│     └───────┬───────┘          └───────┬───────┘       │
│             │                          │               │
│             ▼                          ▼               │
│  ┌──────────────────────────────────────────────────┐  │
│  │   Internal Domain Services & Server Actions      │  │
│  │   (Drizzle ORM / PostgreSQL / Redis / WS Hub)    │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Transport Options

1. **Remote Web MCP via SSE (Server-Sent Events)**:
   - Implemented via `@modelcontextprotocol/sdk/server/sse.js`.
   - `/api/mcp/sse`: Establishes the downstream SSE channel pushing tool lists, resource updates, and notifications.
   - `/api/mcp/messages?sessionId=<id>`: Receives standard JSON-RPC 2.0 requests from the MCP client.
   - Ideal for external agents (Claude Desktop, Cursor, remote agent orchestrators).

2. **In-Browser WebMCP (W3C Draft / In-Process)**:
   - Client-side React drawer communicating with Next.js Server Actions directly or via `window.navigator.modelContext` where browser-supported.
   - Eliminates need for external API tokens for users already logged in via session cookie.

---

## 4. Privacy & Security Model (Zero-Data Principles)

PactTab's core differentiator is strict user privacy. The Web MCP implementation must adhere to these non-negotiable security guardrails:

1. **No Personal Data Leakage**:
   - Schema only stores `username` and internal `id`. Tool outputs strictly omit email, IP address, or external identifiers.
2. **Scoped Authentication**:
   - **Session-bound**: In-browser calls inherit the user's encrypted HTTP-only session cookie.
   - **Personal Access Tokens (PAT)**: For external agents, users generate scoped tokens (e.g., `pact_live_...`) with selectable scopes (`read:balances`, `write:expenses`, `admin:groups`) and 30-day auto-expiry.
3. **Strict Group Boundaries**:
   - Every tool call executes within the caller's authorized groups (`group_members` where `status = 'active'`). Cross-tenant or unauthorized group access returns `403 Forbidden`.
4. **Human-in-the-Loop Confirmation for Mutations**:
   - Destructive or high-impact actions (deleting an expense, revoking all invites) require explicit affirmative confirmation before committing.

---

## 5. Proposed MCP Tools & Resources Specification

### A. Tools (Functions the Agent Can Execute)

| Tool Name             | Parameters                                                       | Description                                                                              |
| :-------------------- | :--------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `list_user_groups`    | _None_                                                           | Returns all groups the authenticated user belongs to.                                    |
| `get_group_balances`  | `groupId: string`                                                | Returns net balances, who owes whom, and optimal settlement transactions.                |
| `list_expenses`       | `groupId: string, limit?: number, offset?: number`               | Returns recent expenses with split breakdown.                                            |
| `create_expense`      | `groupId, description, amount, splitType, paidByUserId, splits?` | Records a new shared expense with equal or custom splits. Validates splits sum = amount. |
| `edit_expense`        | `expenseId, description?, amount?, splits?`                      | Updates an existing expense (restricted to expense creator or group admin).              |
| `record_settlement`   | `groupId, paidByUserId, receivedByUserId, amount`                | Records a settlement transfer and posts confirmation to group chat.                      |
| `create_invite_link`  | `groupId, expiresInDays?, maxUses?, requiresApproval?`           | Creates a customizable invite link (Admin only).                                         |
| `review_join_request` | `requestId: string, action: 'approve' \| 'decline'`              | Approves or declines a pending membership request (Admin only).                          |

### B. Resources (Context the Agent Can Read)

| Resource URI                                 | Description                                                   | MIME Type          |
| :------------------------------------------- | :------------------------------------------------------------ | :----------------- |
| `pacttab://groups/{groupId}/balances`        | Live balance sheet and debt simplification matrix.            | `application/json` |
| `pacttab://groups/{groupId}/expenses/recent` | Last 20 expenses with full participant breakdowns.            | `application/json` |
| `pacttab://groups/{groupId}/chat/recent`     | Recent group chat messages to provide conversational context. | `text/plain`       |

### C. Prompts (Guided AI Workflows)

- `split_bill_wizard`: Guides the model through parsing an invoice or receipt text and assigning line items to group members.
- `settlement_brief`: Generates a clear, friendly chat message summarizing who should pay what before a trip ends.

---

## 6. Proof of Concept: Prototype Implementation

### 6.1 Dependency Installation

```bash
pnpm add @modelcontextprotocol/sdk zod
```

### 6.2 SSE Route Handler (`src/app/api/mcp/sse/route.ts`)

```typescript
import { NextRequest } from "next/server";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createPactTabMcpServer } from "@/lib/mcp/server";
import { validateMcpAuth } from "@/lib/mcp/auth";

// Active sessions map
const transports = new Map<string, SSEServerTransport>();

export async function GET(req: NextRequest) {
  // 1. Authenticate user via Bearer token or session
  const user = await validateMcpAuth(req);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 2. Initialize SSE transport
  const transport = new SSEServerTransport("/api/mcp/messages", new Response());
  const server = createPactTabMcpServer(user);

  await server.connect(transport);
  transports.set(transport.sessionId, transport);

  return transport.response;
}
```

### 6.3 Tool Implementation Sample (`src/lib/mcp/tools/expenses.ts`)

```typescript
import { z } from "zod";
import { db } from "@/db";
import { expenses, expenseSplits, groupMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const createExpenseTool = {
  name: "create_expense",
  description: "Create an expense for a group with equal or custom splits",
  parameters: z.object({
    groupId: z.string().describe("The ID of the group"),
    description: z.string().max(255).describe("Description of what was paid for"),
    amount: z.number().positive().describe("Total amount paid"),
    splitType: z.enum(["equal", "custom"]).default("equal"),
    splits: z
      .array(
        z.object({
          userId: z.string(),
          owedAmount: z.number().positive(),
        })
      )
      .optional()
      .describe("Custom split amounts per user (required if splitType is 'custom')"),
  }),
  execute: async (args: any, context: { userId: string }) => {
    // 1. Verify user membership in group
    const membership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, args.groupId),
        eq(groupMembers.userId, context.userId),
        eq(groupMembers.status, "active")
      ),
    });

    if (!membership) {
      throw new Error("You are not an active member of this group");
    }

    // 2. Compute splits if equal
    let finalSplits = args.splits;
    if (args.splitType === "equal") {
      const activeMembers = await db.query.groupMembers.findMany({
        where: and(eq(groupMembers.groupId, args.groupId), eq(groupMembers.status, "active")),
      });
      const perPerson = Number((args.amount / activeMembers.length).toFixed(2));
      finalSplits = activeMembers.map((m) => ({
        userId: m.userId,
        owedAmount: perPerson,
      }));
    }

    // 3. Persist expense in database transaction
    const expenseId = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(expenses).values({
        id: expenseId,
        groupId: args.groupId,
        description: args.description,
        amount: args.amount.toFixed(2),
        paidByUserId: context.userId,
        createdBy: context.userId,
      });

      for (const split of finalSplits) {
        await tx.insert(expenseSplits).values({
          id: crypto.randomUUID(),
          expenseId,
          userId: split.userId,
          owedAmount: split.owedAmount.toFixed(2),
        });
      }
    });

    return {
      success: true,
      expenseId,
      message: `Recorded expense "${args.description}" for ₹${args.amount}`,
    };
  },
};
```

---

## 7. Implementation Milestones

| Phase       | Objective                         | Deliverables                                                                                                                    | Est. Effort |
| :---------- | :-------------------------------- | :------------------------------------------------------------------------------------------------------------------------------ | :---------- |
| **Phase 1** | **MCP Core & Tool Definitions**   | `@modelcontextprotocol/sdk` integration, Zod schemas, read/write tool handlers for groups, expenses, balances, and settlements. | 2 days      |
| **Phase 2** | **Remote Web Transport (SSE)**    | `/api/mcp/sse` and `/api/mcp/messages` endpoints, bearer token authorization, connection pooling.                               | 2 days      |
| **Phase 3** | **Testing & Client Verification** | Connect Claude Desktop and Cursor via remote SSE URL. Add Vitest suite (`tests/mcp-server.test.ts`).                            | 1 day       |
| **Phase 4** | **In-App AI Assistant Drawer**    | Optional UI component in PactTab allowing in-browser conversational chat that executes MCP tools locally.                       | 3 days      |

---

## 8. Success Criteria

1. **Claude Desktop Integration**: Able to add PactTab SSE endpoint to `claude_desktop_config.json`, query _"What are my active groups in PactTab?"_, and receive formatted groups.
2. **Safe Mutation**: Able to command _"Add an expense for lunch of ₹900 split between Arjun and me"_ and verify the expense appears instantly in the web UI via WebSocket sync.
3. **Zero Leaks**: Verified by tests that no sensitive credentials, session cookies, or external PII are returned through tool outputs or resource endpoints.
