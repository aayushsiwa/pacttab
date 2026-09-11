# MVP: Private Group Expenses & Chat

## Product summary

A privacy-first progressive web app for small, closed groups to chat, track shared expenses, and settle balances. People sign up using only a username and password—no email, phone number, contact syncing, or public discovery.

The product is for flatmates, trips, friend groups, couples, and small teams that want a simple shared tab without handing over their address book or personal details.

## Problem

Existing expense-splitting apps often require personal information, build social graphs, and include more financial features than a small group needs. They can feel excessive for a private trip, household, or event.

Users need a lightweight private space where they can:

- Invite only the people relevant to a group
- Discuss plans and expenses in one place
- Record who paid and who owes what
- Settle up without complicated financial workflows

## MVP goal

Validate that closed groups will use a simple private app to coordinate spending and conversation.

The MVP should let a group go from creation to a settled balance in a few minutes.

## Target users

- Flatmates splitting household costs
- Friends organizing a trip or event
- Couples managing shared purchases
- Small informal teams sharing event costs

## Core user flow

1. A person creates an account with a unique username and password.
2. They create a private group.
3. They generate an invite link and share it with the intended people.
4. Invitees sign in or create an account, then join the group through that link.
5. Group members chat and add shared expenses.
6. The app calculates balances and suggested settlements.
7. Members record a settlement when someone pays another member.

## MVP features

### Accounts

- Username and password sign-up
- Sign-in and sign-out
- Secure password hashing and cookie-based sessions
- No email address, phone number, contact importing, or public user search
- Clear notice: passwords cannot be recovered in the MVP
- Optional one-time recovery codes can be added after the initial release

### Private groups

- Create a group with a name and optional description
- Group roles:
  - Admin: manages group settings, people, and invites
  - Member: chats, adds expenses, and records settlements
- Only group members can view its messages, expenses, and balances
- Groups are not publicly searchable

### Invites and join approval

- Admins can create a unique invite link for a group
- A valid invite lets an authenticated user join immediately
- Admins can revoke an invite link
- Invite links use long, random, unguessable tokens
- A person without a valid invitation cannot browse or join a group
- If a future shared group reference creates a join request, it remains pending until an admin approves or declines it

For the initial MVP, a direct invite link is the only practical join path. Join requests can be included as a small admin queue if there is a way for non-members to submit them without exposing group data.

### Group chat

- Text messages in each group
- Chronological message list
- Messages show username and timestamp
- System activity messages, such as:
  - “Maya added Dinner — ₹1,200”
  - “Arjun recorded a settlement of ₹600 to Maya”
- No direct messages, reactions, image uploads, threads, read receipts, or notifications in the first version

### Expenses

- Add an expense with:
  - Description
  - Amount
  - Person who paid
  - Date
  - Participants
  - Split method
- Support equal splits first
- Support custom exact amounts if implementation remains simple
- Edit or delete an expense created by the member
- Show an activity record when expenses change

### Balances and settlements

- Show each member’s net balance:
  - Positive: is owed money
  - Negative: owes money
- Show simplified suggested repayments
- Record a settlement: payer, recipient, amount, and date
- Settlements update balances but do not process payments
- No bank integrations, wallets, payment collection, exchange rates, or recurring expenses in the MVP

## Non-goals

The MVP explicitly does not include:

- Email or phone verification
- Password recovery by email
- Social discovery or contact syncing
- Public groups
- Direct messages
- Media sharing
- Push notifications
- Payment processing
- Multiple currencies
- Receipt scanning
- Recurring bills
- Advanced split rules such as percentages, shares, or itemized receipts
- Native mobile apps

## Privacy principles

- Collect the minimum information: username and password only
- Never request contacts, a phone number, or an email address
- Make groups private by default and permanently non-discoverable
- Use opaque random identifiers for invite links
- Never expose a group’s membership, messages, or expenses to non-members
- Provide group deletion and account deletion as a planned early post-MVP feature
- Avoid behavioral advertising and unnecessary third-party tracking

## Technical approach

- Framework: Next.js, full-stack App Router application
- PWA: web manifest, installable experience, mobile-first responsive UI, basic offline shell
- Authentication: Better Auth with username/password credentials
- Database: PostgreSQL
- ORM: Drizzle ORM
- Hosting: Vercel or Railway for the app, managed PostgreSQL through Neon, Supabase, or Railway
- Real-time updates: start with polling or refresh; add WebSockets/Supabase Realtime only if chat responsiveness becomes a clear need

## Core data entities

```text
User
  id, username, passwordHash, createdAt

Group
  id, name, description, createdBy, createdAt

GroupMember
  id, groupId, userId, role, status, joinedAt

InviteLink
  id, groupId, token, createdBy, expiresAt, maxUses, useCount, revokedAt

JoinRequest
  id, groupId, userId, status, reviewedBy, reviewedAt

Message
  id, groupId, authorId, body, type, createdAt

Expense
  id, groupId, description, amount, paidByUserId, expenseDate, createdBy, createdAt

ExpenseSplit
  id, expenseId, userId, owedAmount

Settlement
  id, groupId, paidByUserId, receivedByUserId, amount, settledAt, createdAt
```

## Success criteria

A successful MVP allows a new user to:

1. Create an account in under one minute.
2. Create a group and share an invite link.
3. Have another person join privately.
4. Add an equal-split expense.
5. See an accurate balance.
6. Record a settlement.
7. Use group chat alongside the financial activity without leaving the app.

## Suggested release sequence

### Release 1 (Shipped)

Authentication, private groups, direct invite links, equal-split expenses, balances, settlements, and basic group chat.

### Release 2 (Shipped)

- Invite expiry, usage limits, custom invite tokens, and revoke/rotate actions
- Admin join-request queue with pending status chips for requesters & notification indicators for admins
- Custom splits (exact amounts per participant) alongside equal splits
- Settlement affirmation workflow (payer records, receiver affirms/disputes)
- Real-time WebSockets with Redis pub/sub and group `@mention` autocomplete
- Installable PWA with offline fallback shell and manifest
- Automated test coverage via Vitest (10 test suites, 44 tests)

### Release 3 (Planned)

Offline expense drafts, external push notifications, attachments/receipt uploads, recurring expenses, multiple currencies, Web MCP (Model Context Protocol) agent connectivity ([POC](docs/web-mcp-poc.md)), and optional payment-link integrations.
